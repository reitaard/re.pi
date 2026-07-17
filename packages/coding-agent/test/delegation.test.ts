import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
	createModels,
	fauxAssistantMessage,
	fauxProvider,
	type RegisterFauxProviderOptions,
} from "@reitaard/repi-ai";
import { describe, expect, it } from "vitest";
import { createDelegateTool } from "../src/core/delegation/delegate-tool.ts";
import {
	type NamedWorkerDefinition,
	runNamedWorker,
} from "../src/core/delegation/named-worker.ts";
import { REPI_NAMED_WORKERS } from "../src/core/delegation/worker-registry.ts";

let providerCount = 0;

function createFaux(options: RegisterFauxProviderOptions = {}) {
	const registration = fauxProvider({ provider: `delegation-test-${++providerCount}`, ...options });
	const models = createModels();
	models.setProvider(registration.provider);
	return { registration, models };
}

function worker(overrides: Partial<NamedWorkerDefinition> = {}): NamedWorkerDefinition {
	return {
		id: "reviewer",
		displayName: "Reviewer",
		description: "Inspects code and returns focused evidence.",
		...overrides,
	};
}

function messageText(messages: Array<{ role: string; content: unknown }>): string {
	return messages
		.flatMap((message) => {
			if (typeof message.content === "string") return [message.content];
			if (!Array.isArray(message.content)) return [];
			return message.content.flatMap((part) =>
				part && typeof part === "object" && "type" in part && part.type === "text" && "text" in part
					? [String(part.text)]
					: [],
			);
		})
		.join("\n");
}

describe("named worker delegation spike", () => {
	it("registers only the two stable worker ids with swappable display names", () => {
		expect(REPI_NAMED_WORKERS.map(({ id, displayName }) => ({ id, displayName }))).toEqual([
			{ id: "research", displayName: "Mayuri" },
			{ id: "audit", displayName: "Levi" },
		]);
		expect(REPI_NAMED_WORKERS.find((candidate) => candidate.id === "research")?.skillName).toBe("librarian");
	});

	it("runs one isolated named worker with only read-only tools", async () => {
		const { registration, models } = createFaux();
		let toolNames: string[] = [];
		let systemPrompt = "";
		registration.setResponses([
			(context) => {
				toolNames = context.tools?.map((tool) => tool.name) ?? [];
				systemPrompt = context.systemPrompt ?? "";
				return fauxAssistantMessage("Found one concrete issue in src/example.ts.");
			},
		]);

		const result = await runNamedWorker({
			cwd: process.cwd(),
			model: registration.getModel(),
			models,
			worker: worker(),
			task: "Inspect the example module.",
		});

		expect(result.status).toBe("completed");
		expect(result.output).toContain("concrete issue");
		expect(result.workerId).toBe("reviewer");
		expect(toolNames).toEqual(["read", "grep", "find", "ls"]);
		expect(toolNames).not.toContain("delegate");
		expect(systemPrompt).toContain("You are Reviewer");
		expect(systemPrompt).toContain("Do not delegate");
	});

	it("explicitly invokes Mayuri's loaded librarian skill", async () => {
		const { registration, models } = createFaux();
		const dir = await mkdtemp(join(tmpdir(), "repi-librarian-"));
		const skillPath = join(dir, "SKILL.md");
		await writeFile(
			skillPath,
			"---\nname: librarian\ndescription: Find authoritative sources.\n---\n\n# Librarian\nPrefer authoritative sources.",
			"utf8",
		);
		let prompt = "";
		registration.setResponses([
			(context) => {
				prompt = messageText(context.messages);
				return fauxAssistantMessage("Research complete.");
			},
		]);

		try {
			const result = await runNamedWorker({
				cwd: process.cwd(),
				model: registration.getModel(),
				models,
				worker: worker({ id: "research", displayName: "Mayuri", skillName: "librarian" }),
				skills: [
					{
						name: "librarian",
						description: "Find authoritative sources.",
						filePath: skillPath,
					},
				],
				task: "Find the authoritative lifecycle documentation.",
			});

			expect(result.status).toBe("completed");
			expect(prompt).toContain('<skill name="librarian"');
			expect(prompt).toContain("Prefer authoritative sources");
			expect(prompt).toContain("Find the authoritative lifecycle documentation");
		} finally {
			await rm(dir, { recursive: true, force: true });
		}
	});

	it("returns a typed failure when a required worker skill is not loaded", async () => {
		const { registration, models } = createFaux();
		const result = await runNamedWorker({
			cwd: process.cwd(),
			model: registration.getModel(),
			models,
			worker: worker({ id: "research", displayName: "Mayuri", skillName: "librarian" }),
			task: "Research the repository.",
		});

		expect(result.status).toBe("failed");
		expect(result.error).toContain('requires the loaded skill "librarian"');
	});

	it("supports a smaller worker-specific read-only tool set", async () => {
		const { registration, models } = createFaux();
		let toolNames: string[] = [];
		registration.setResponses([
			(context) => {
				toolNames = context.tools?.map((tool) => tool.name) ?? [];
				return fauxAssistantMessage("done");
			},
		]);

		const result = await runNamedWorker({
			cwd: process.cwd(),
			model: registration.getModel(),
			models,
			worker: worker({ tools: ["read", "grep"] }),
			task: "Inspect only matching source text.",
		});

		expect(result.status).toBe("completed");
		expect(toolNames).toEqual(["read", "grep"]);
	});

	it("clips oversized worker output before returning it to the parent", async () => {
		const { registration, models } = createFaux();
		registration.setResponses([() => fauxAssistantMessage("x".repeat(500))]);

		const result = await runNamedWorker({
			cwd: process.cwd(),
			model: registration.getModel(),
			models,
			worker: worker(),
			task: "Return a deliberately long result.",
			maxResultCharacters: 100,
		});

		expect(result.status).toBe("completed");
		expect(result.truncated).toBe(true);
		expect(result.output.length).toBeLessThanOrEqual(100);
		expect(result.output).toContain("delegated result truncated");
	});

	it("propagates parent cancellation to the child harness", async () => {
		const { registration, models } = createFaux();
		let release = () => {};
		const blocked = new Promise<void>((resolve) => {
			release = resolve;
		});
		registration.setResponses([
			async () => {
				await blocked;
				return fauxAssistantMessage("late result");
			},
		]);
		const controller = new AbortController();

		const running = runNamedWorker({
			cwd: process.cwd(),
			model: registration.getModel(),
			models,
			worker: worker(),
			task: "Wait until cancelled.",
			signal: controller.signal,
		});
		await new Promise((resolve) => setTimeout(resolve, 0));
		controller.abort();
		release();

		const result = await running;
		expect(result.status).toBe("cancelled");
		expect(result.output).toBe("");
	});

	it("exposes the named worker through one parallel-safe parent-facing delegate tool", async () => {
		const { registration, models } = createFaux();
		registration.setResponses([() => fauxAssistantMessage("Reviewed the requested boundary.")]);
		const delegate = createDelegateTool({
			cwd: process.cwd(),
			model: registration.getModel(),
			models,
			workers: [worker()],
		});

		expect(delegate.executionMode).toBe("parallel");
		const toolResult = await delegate.execute("call-1", {
			worker: "reviewer",
			task: "Review the boundary.",
		});

		expect(toolResult.details.result.status).toBe("completed");
		expect(toolResult.details.result.workerName).toBe("Reviewer");
		expect(toolResult.content[0]).toMatchObject({
			type: "text",
			text: expect.stringContaining("Reviewed the requested boundary"),
		});
	});

	it("rejects unsupported tools so a child cannot receive delegate", async () => {
		const { registration, models } = createFaux();

		await expect(
			runNamedWorker({
				cwd: process.cwd(),
				model: registration.getModel(),
				models,
				worker: worker({ tools: ["delegate" as never] }),
				task: "Attempt nested delegation.",
			}),
		).rejects.toThrow("Unsupported delegated worker tool: delegate");
	});
});
