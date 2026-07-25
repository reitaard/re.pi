import { mkdtemp, mkdir, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
	createModels,
	fauxAssistantMessage,
	fauxProvider,
} from "@earendil-works/pi-ai";
import { describe, expect, it } from "vitest";
import {
	formatNamedWorkerIdentity,
	getNamedWorkerReferences,
	runNamedWorker,
	type NamedWorkerDefinition,
} from "../src/repi/delegation/named-worker.ts";
import { createWorkspaceToolCallGuard } from "../src/repi/delegation/workspace-guard.ts";

function worker(overrides: Partial<NamedWorkerDefinition> = {}): NamedWorkerDefinition {
	return {
		id: "audit",
		displayName: "Levi",
		aliases: ["監査"],
		description: "Audits a bounded target.",
		tools: [],
		thinkingLevel: "off",
		maxOutputTokens: 1024,
		...overrides,
	};
}

function fauxModels(text: string) {
	const models = createModels();
	const faux = fauxProvider({ provider: `repi-worker-${Math.random().toString(16).slice(2)}` });
	models.setProvider(faux.provider);
	faux.setResponses([fauxAssistantMessage(text)]);
	return { models, model: faux.getModel() };
}

describe("RePi named workers", () => {
	it("keeps stable ids separate from display names and aliases", () => {
		const definition = worker();
		expect(formatNamedWorkerIdentity(definition)).toBe("Levi (監査)");
		expect(getNamedWorkerReferences(definition)).toEqual(["audit", "Levi", "監査", "Levi (監査)"]);
	});

	it("runs in an isolated journaled harness and reports bounded progress", async () => {
		const { models, model } = fauxModels("precise audit result");
		const progress: string[] = [];
		const result = await runNamedWorker({
			cwd: process.cwd(),
			worker: worker(),
			task: "Audit this boundary",
			models,
			model,
			onProgress: (event) => progress.push(event.type),
		});

		expect(result).toMatchObject({
			workerId: "audit",
			workerName: "Levi",
			status: "completed",
			output: "precise audit result",
			truncated: false,
		});
		expect(result.runId).toEqual(expect.any(String));
		expect(result.harnessSetupDurationMs).toBeGreaterThanOrEqual(0);
		expect(progress).toEqual(["start", "complete"]);
	});

	it("clips only the parent-visible result", async () => {
		const { models, model } = fauxModels("abcdefghijklmnop");
		const result = await runNamedWorker({
			cwd: process.cwd(),
			worker: worker(),
			task: "Return text",
			models,
			model,
			maxResultCharacters: 10,
		});

		expect(result.status).toBe("completed");
		expect(result.output).toHaveLength(10);
		expect(result.truncated).toBe(true);
	});

	it("returns cancellation before starting a provider request", async () => {
		const { models, model } = fauxModels("unused");
		const controller = new AbortController();
		controller.abort();
		const result = await runNamedWorker({
			cwd: process.cwd(),
			worker: worker(),
			task: "Do not start",
			models,
			model,
			signal: controller.signal,
		});

		expect(result.status).toBe("cancelled");
		expect(result.error).toContain("before start");
	});

	it("requires host-provided web tools for web workers", async () => {
		const { models, model } = fauxModels("unused");
		await expect(
			runNamedWorker({
				cwd: process.cwd(),
				worker: worker({ id: "research", displayName: "Mayuri", tools: ["web_search"] }),
				task: "Research",
				models,
				model,
			}),
		).rejects.toThrow("Required named-worker tool is unavailable: web_search");
	});
});

describe("RePi delegated workspace guard", () => {
	it("allows workspace paths and blocks parent traversal", async () => {
		const root = await mkdtemp(join(tmpdir(), "repi-worker-"));
		await writeFile(join(root, "inside.txt"), "inside");
		const guard = createWorkspaceToolCallGuard(root);

		await expect(guard({ toolName: "read", input: { path: "inside.txt" } })).resolves.toBeUndefined();
		await expect(guard({ toolName: "read", input: { path: "../outside.txt" } })).resolves.toMatchObject({
			block: true,
		});
	});

	it("blocks an existing symlink that escapes the workspace", async () => {
		const root = await mkdtemp(join(tmpdir(), "repi-worker-root-"));
		const outside = await mkdtemp(join(tmpdir(), "repi-worker-outside-"));
		await writeFile(join(outside, "secret.txt"), "secret");
		await mkdir(join(root, "links"));
		try {
			await symlink(outside, join(root, "links", "outside"), "junction");
		} catch {
			return;
		}
		const guard = createWorkspaceToolCallGuard(root);

		await expect(
			guard({ toolName: "read", input: { path: join("links", "outside", "secret.txt") } }),
		).resolves.toMatchObject({ block: true });
	});
});
