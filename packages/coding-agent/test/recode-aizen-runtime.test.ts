import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createModels, fauxAssistantMessage, fauxProvider } from "@reitaard/repi-ai";
import { afterEach, describe, expect, test } from "vitest";
import type { AgentSession, AizenRuntimeProfile } from "../src/core/agent-session.ts";
import { createAizenRuntime } from "../src/core/recode-aizen-runtime.ts";
import { SessionManager } from "../src/core/session-manager.ts";

const tempDirs: string[] = [];
const noOpHooks: AizenRuntimeProfile["hooks"] = {
	beforeAgentStart: async () => undefined,
	context: async (event) => ({ messages: event.messages }),
	beforeProviderPayload: async (event) => ({ payload: event.payload }),
	afterProviderResponse: async () => undefined,
	toolCall: async () => undefined,
	toolResult: async () => undefined,
};

afterEach(() => {
	for (const dir of tempDirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

describe("Aizen runtime", () => {
	test("runs through AgentHarness and persists into the existing RePi session", async () => {
		const root = mkdtempSync(join(tmpdir(), "recode-aizen-runtime-"));
		tempDirs.push(root);
		const manager = SessionManager.create(root, root, { id: "aizen-runtime" });
		const models = createModels();
		const faux = fauxProvider({ provider: "aizen-faux" });
		faux.setResponses([fauxAssistantMessage("Aizen ready")]);
		models.setProvider(faux.provider);
		const profile: AizenRuntimeProfile = {
			model: faux.getModel(),
			thinkingLevel: "off",
			tools: [],
			systemPrompt: "You are Aizen.",
			activeToolNames: [],
			steeringMode: "one-at-a-time",
			followUpMode: "one-at-a-time",
			resources: {},
			hooks: noOpHooks,
		};
		const agentSession = {
			sessionManager: manager,
			modelRegistry: {},
			createAizenRuntimeProfile: () => profile,
		} as AgentSession;
		const runtime = createAizenRuntime({ agentSession, cwd: root, models });

		const eventTypes: string[] = [];
		runtime.subscribe((event) => eventTypes.push(event.type));
		const response = await runtime.prompt("Inspect the project");

		expect(response.content).toEqual([{ type: "text", text: "Aizen ready" }]);
		expect(runtime.profile).toBe(profile);
		const reopened = SessionManager.open(manager.getSessionFile()!);
		const branch = reopened.getBranch();
		expect(branch.map((entry) => entry.type)).toEqual(["message", "message"]);
		expect(branch[0]).toMatchObject({
			message: { role: "user", content: [{ type: "text", text: "Inspect the project" }] },
		});
		expect(branch[1]).toMatchObject({
			parentId: branch[0]?.id,
			message: { role: "assistant", content: [{ type: "text", text: "Aizen ready" }] },
		});
		expect(eventTypes.at(-2)).toBe("agent_end");
		expect(eventTypes.at(-1)).toBe("agent_settled");
	});

	test("preserves retry lifecycle events across one recovered Aizen prompt", async () => {
		const root = mkdtempSync(join(tmpdir(), "recode-aizen-runtime-retry-"));
		tempDirs.push(root);
		const manager = SessionManager.inMemory(root);
		const models = createModels();
		const faux = fauxProvider({ provider: "aizen-retry-faux" });
		faux.setResponses([
			fauxAssistantMessage("", { stopReason: "error", errorMessage: "overloaded_error" }),
			fauxAssistantMessage("Recovered"),
		]);
		models.setProvider(faux.provider);
		const profile: AizenRuntimeProfile = {
			model: faux.getModel(),
			thinkingLevel: "off",
			tools: [],
			systemPrompt: "You are Aizen.",
			activeToolNames: [],
			steeringMode: "one-at-a-time",
			followUpMode: "one-at-a-time",
			resources: {},
			hooks: noOpHooks,
			recovery: {
				compaction: { enabled: false, reserveTokens: 16384, keepRecentTokens: 20000 },
				retry: { enabled: true, maxRetries: 1, baseDelayMs: 0 },
			},
		};
		const agentSession = {
			sessionManager: manager,
			modelRegistry: {},
			createAizenRuntimeProfile: () => profile,
		} as AgentSession;
		const runtime = createAizenRuntime({ agentSession, cwd: root, models });
		const events: Array<{ type: string; willRetry?: boolean; success?: boolean }> = [];
		runtime.subscribe((event) => events.push(event));

		const response = await runtime.prompt("Recover once");

		expect(response.content).toEqual([{ type: "text", text: "Recovered" }]);
		expect(events.filter((event) => event.type === "agent_end")).toEqual([
			expect.objectContaining({ willRetry: true }),
			expect.objectContaining({ willRetry: false }),
		]);
		expect(events).toEqual(
			expect.arrayContaining([
				expect.objectContaining({ type: "auto_retry_start" }),
				expect.objectContaining({ type: "auto_retry_end", success: true }),
			]),
		);
		expect(events.at(-1)?.type).toBe("agent_settled");
	});

	test("passes resources and prepared extension output into AgentHarness", async () => {
		const root = mkdtempSync(join(tmpdir(), "recode-aizen-runtime-hooks-"));
		tempDirs.push(root);
		const manager = SessionManager.inMemory(root);
		const models = createModels();
		const faux = fauxProvider({ provider: "aizen-hooks-faux" });
		let capturedSystemPrompt = "";
		let capturedMessages: unknown[] = [];
		faux.setResponses([
			(context) => {
				capturedSystemPrompt = context.systemPrompt ?? "";
				capturedMessages = context.messages;
				return fauxAssistantMessage("Prepared");
			},
		]);
		models.setProvider(faux.provider);
		const profile: AizenRuntimeProfile = {
			model: faux.getModel(),
			thinkingLevel: "off",
			tools: [],
			systemPrompt: "Base prompt",
			activeToolNames: [],
			steeringMode: "one-at-a-time",
			followUpMode: "one-at-a-time",
			resources: {
				promptTemplates: [{ name: "review", content: "Review $ARGUMENTS" }],
				skills: [
					{
						name: "audit",
						description: "Audit code",
						content: "Audit carefully",
						filePath: join(root, "SKILL.md"),
					},
				],
			},
			hooks: {
				...noOpHooks,
				beforeAgentStart: async () => ({
					systemPrompt: "Extension prompt",
					messages: [
						{
							role: "custom",
							customType: "prepared-context",
							content: [{ type: "text", text: "Extension context" }],
							display: false,
							timestamp: Date.now(),
						},
					],
				}),
			},
		};
		const agentSession = {
			sessionManager: manager,
			modelRegistry: {},
			createAizenRuntimeProfile: () => profile,
		} as AgentSession;
		const runtime = createAizenRuntime({ agentSession, cwd: root, models });

		await runtime.harness.prompt("Inspect resources");

		expect(runtime.harness.getResources()).toEqual(profile.resources);
		expect(capturedSystemPrompt).toBe("Extension prompt");
		expect(capturedMessages).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					role: "user",
					content: [{ type: "text", text: "Extension context" }],
				}),
			]),
		);
	});
});
