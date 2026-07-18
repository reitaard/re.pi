import { existsSync, mkdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Agent } from "@reitaard/repi-agent-core";
import {
	type AssistantMessage,
	type AssistantMessageEvent,
	EventStream,
	getModel,
	type Model,
} from "@reitaard/repi-ai/compat";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AgentSession } from "../src/core/agent-session.ts";
import type { AgentSessionRuntime } from "../src/core/agent-session-runtime.ts";
import { AuthStorage } from "../src/core/auth-storage.ts";
import { ModelRegistry } from "../src/core/model-registry.ts";
import type { createAizenRuntime } from "../src/core/recode-aizen-runtime.ts";
import { SessionManager } from "../src/core/session-manager.ts";
import { SettingsManager } from "../src/core/settings-manager.ts";
import { runRpcMode } from "../src/modes/rpc/rpc-mode.ts";
import { createTestResourceLoader } from "./utilities.ts";

const rpcIo = vi.hoisted(() => ({
	outputLines: [] as string[],
	lineHandler: undefined as ((line: string) => void) | undefined,
}));

vi.mock("../src/core/output-guard.js", () => ({
	flushRawStdout: vi.fn(async () => {}),
	takeOverStdout: vi.fn(),
	waitForRawStdoutBackpressure: vi.fn(async () => {}),
	writeRawStdout: (line: string) => {
		rpcIo.outputLines.push(line);
	},
}));

vi.mock("../src/modes/interactive/theme/theme.js", () => ({ theme: {} }));

vi.mock("../src/modes/rpc/jsonl.js", () => ({
	attachJsonlLineReader: vi.fn((_stream: NodeJS.ReadableStream, onLine: (line: string) => void) => {
		rpcIo.lineHandler = onLine;
		return () => {};
	}),
	serializeJsonLine: (value: unknown) => `${JSON.stringify(value)}\n`,
}));

class MockAssistantStream extends EventStream<AssistantMessageEvent, AssistantMessage> {
	constructor() {
		super(
			(event) => event.type === "done" || event.type === "error",
			(event) => {
				if (event.type === "done") return event.message;
				if (event.type === "error") return event.error;
				throw new Error("Unexpected event type");
			},
		);
	}
}

function createAssistantMessage(text: string): AssistantMessage {
	return {
		role: "assistant",
		content: [{ type: "text", text }],
		api: "anthropic-messages",
		provider: "anthropic",
		model: "claude-sonnet-4-5",
		usage: {
			input: 0,
			output: 0,
			cacheRead: 0,
			cacheWrite: 0,
			totalTokens: 0,
			cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
		},
		stopReason: "stop",
		timestamp: Date.now(),
	};
}

type ParsedOutputLine = Record<string, unknown>;

function parseOutputLines(outputLines: string[]): ParsedOutputLine[] {
	return outputLines
		.flatMap((line) => line.split("\n"))
		.filter((line) => line.trim().length > 0)
		.map((line) => JSON.parse(line) as ParsedOutputLine);
}

function getPromptResponses(outputLines: string[], id: string): ParsedOutputLine[] {
	return parseOutputLines(outputLines).filter(
		(record) => record.id === id && record.type === "response" && record.command === "prompt",
	);
}

function sleep(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

function createRuntimeHost(options: { withAuth: boolean; responseDelayMs: number; model?: Model<any> }): {
	runtimeHost: AgentSessionRuntime;
	cleanup: () => Promise<void>;
} {
	const tempDir = join(tmpdir(), `pi-rpc-prompt-${Date.now()}-${Math.random().toString(36).slice(2)}`);
	mkdirSync(tempDir, { recursive: true });

	const model = options.model ?? getModel("anthropic", "claude-sonnet-4-5");
	if (!model) {
		throw new Error("Test model not found");
	}

	const agent = new Agent({
		getApiKey: () => "test-key",
		initialState: {
			model,
			systemPrompt: "Test",
			tools: [],
		},
		streamFn: (_model, _context, _options) => {
			const stream = new MockAssistantStream();
			queueMicrotask(() => {
				stream.push({ type: "start", partial: createAssistantMessage("") });
				setTimeout(() => {
					stream.push({ type: "done", reason: "stop", message: createAssistantMessage("done") });
				}, options.responseDelayMs);
			});
			return stream;
		},
	});

	const sessionManager = SessionManager.inMemory();
	const settingsManager = SettingsManager.create(tempDir, tempDir);
	const authStorage = AuthStorage.create(join(tempDir, "auth.json"));
	const modelRegistry = ModelRegistry.create(authStorage, tempDir);
	if (options.withAuth) {
		authStorage.setRuntimeApiKey("anthropic", "test-key");
	}

	const session = new AgentSession({
		agent,
		sessionManager,
		settingsManager,
		cwd: tempDir,
		modelRegistry,
		resourceLoader: createTestResourceLoader(),
	});

	const runtimeHost = {
		session,
		newSession: vi.fn(async () => ({ cancelled: true })),
		switchSession: vi.fn(async () => ({ cancelled: true })),
		fork: vi.fn(async () => ({ cancelled: true, selectedText: "" })),
		dispose: vi.fn(async () => {}),
		setRebindSession: vi.fn(),
	} as unknown as AgentSessionRuntime;

	return {
		runtimeHost,
		cleanup: async () => {
			try {
				if (session.isStreaming) {
					await session.abort();
				}
			} catch {
				// ignore test cleanup failures
			}
			session.dispose();
			if (existsSync(tempDir)) {
				rmSync(tempDir, { recursive: true });
			}
		},
	};
}

async function startRpcMode(options: { withAuth: boolean; responseDelayMs: number; model?: Model<any> }): Promise<{
	lineHandler: (line: string) => void;
	cleanup: () => Promise<void>;
}> {
	rpcIo.outputLines = [];
	rpcIo.lineHandler = undefined;

	const { runtimeHost, cleanup } = createRuntimeHost(options);
	void runRpcMode(runtimeHost);
	await vi.waitFor(() => expect(rpcIo.lineHandler).toBeDefined());

	return { lineHandler: rpcIo.lineHandler!, cleanup };
}

describe("RPC prompt response semantics", () => {
	afterEach(() => {
		rpcIo.outputLines = [];
		rpcIo.lineHandler = undefined;
	});

	it("emits one failure response when prompt preflight rejects", async () => {
		const { lineHandler, cleanup } = await startRpcMode({
			withAuth: false,
			responseDelayMs: 0,
			model: {
				id: "fake-model",
				name: "Fake Model",
				api: "openai-completions",
				provider: "fake-provider",
				baseUrl: "https://example.invalid",
				reasoning: false,
				input: [],
				cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
				contextWindow: 0,
				maxTokens: 0,
			},
		});

		try {
			lineHandler(JSON.stringify({ id: "b1", type: "prompt", message: "Hello" }));

			await vi.waitFor(() => {
				const responses = getPromptResponses(rpcIo.outputLines, "b1");
				expect(responses).toHaveLength(1);
				expect(responses[0]).toMatchObject({
					id: "b1",
					type: "response",
					command: "prompt",
					success: false,
					error: expect.stringContaining(
						"No API key found for fake-provider.\n\nUse /login for a hosted provider, or /open-provider for a custom/local OpenAI-compatible endpoint. See:",
					),
				});
			});
		} finally {
			await cleanup();
		}
	});

	it("emits one success response when prompt preflight succeeds", async () => {
		const { lineHandler, cleanup } = await startRpcMode({ withAuth: true, responseDelayMs: 0 });

		try {
			lineHandler(JSON.stringify({ id: "b2", type: "prompt", message: "Hello" }));

			await vi.waitFor(() => {
				const responses = getPromptResponses(rpcIo.outputLines, "b2");
				expect(responses).toHaveLength(1);
				expect(responses[0]).toMatchObject({
					id: "b2",
					type: "response",
					command: "prompt",
					success: true,
				});
			});
		} finally {
			await cleanup();
		}
	});

	it("emits one success response when prompt is queued during streaming", async () => {
		const { lineHandler, cleanup } = await startRpcMode({ withAuth: true, responseDelayMs: 100 });

		try {
			lineHandler(JSON.stringify({ id: "b3-start", type: "prompt", message: "Start" }));
			await vi.waitFor(() => {
				expect(getPromptResponses(rpcIo.outputLines, "b3-start")).toHaveLength(1);
			});

			rpcIo.outputLines = [];
			lineHandler(
				JSON.stringify({
					id: "b3",
					type: "prompt",
					message: "Queue this",
					streamingBehavior: "followUp",
				}),
			);

			await vi.waitFor(() => {
				const responses = getPromptResponses(rpcIo.outputLines, "b3");
				expect(responses).toHaveLength(1);
				expect(responses[0]).toMatchObject({
					id: "b3",
					type: "response",
					command: "prompt",
					success: true,
				});
			});

			await sleep(150);
		} finally {
			await cleanup();
		}
	});

	it("routes accepted prompts, events, and abort through the opted-in Aizen runtime", async () => {
		rpcIo.outputLines = [];
		rpcIo.lineHandler = undefined;
		const { runtimeHost, cleanup } = createRuntimeHost({ withAuth: true, responseDelayMs: 0 });
		let eventListener: ((event: { type: string }) => void) | undefined;
		let releasePrompt: (() => void) | undefined;
		const promptGate = new Promise<void>((resolve) => {
			releasePrompt = resolve;
		});
		const abort = vi.fn(async () => ({ status: "idle" as const }));
		let running = false;
		const prompt = vi.fn(async (_text: string, _options?: { images?: unknown[] }) => {
			running = true;
			eventListener?.({ type: "agent_start" });
			await promptGate;
			running = false;
			eventListener?.({ type: "agent_settled" });
			return createAssistantMessage("Aizen RPC ready");
		});
		vi.spyOn(runtimeHost.session.extensionRunner, "emitInput").mockResolvedValue({
			action: "transform",
			text: "Hello from transform",
		});
		const createRuntime = vi.fn(() => ({
			harness: {
				abort,
				followUp: vi.fn(async () => {}),
				getFollowUpMode: () => "one-at-a-time" as const,
				getSteeringMode: () => "one-at-a-time" as const,
				getThinkingLevel: () => "off" as const,
				setFollowUpMode: vi.fn(async () => {}),
				setSteeringMode: vi.fn(async () => {}),
				setThinkingLevel: vi.fn(async () => {}),
				steer: vi.fn(async () => {}),
				subscribe: vi.fn(() => () => {}),
			},
			profile: {
				model: runtimeHost.session.model,
				resources: {
					skills: [
						{
							name: "rpc-check",
							description: "RPC skill expansion",
							content: "Follow the RPC skill instructions.",
							filePath: "/skills/rpc-check/SKILL.md",
						},
					],
				},
			},
			session: {},
			prompt,
			compact: vi.fn(),
			abortRetry: vi.fn(),
			isCompacting: () => true,
			isRunning: () => running,
			pendingMessageCount: () => 2,
			subscribe: vi.fn((listener: (event: { type: string }) => void) => {
				eventListener = listener;
				return () => {
					eventListener = undefined;
				};
			}),
		}));

		void runRpcMode(
			runtimeHost,
			{ aizenRuntime: true },
			{ createAizenRuntime: createRuntime as unknown as typeof createAizenRuntime },
		);
		await vi.waitFor(() => expect(rpcIo.lineHandler).toBeDefined());
		const lineHandler = rpcIo.lineHandler as unknown as (line: string) => void;

		try {
			lineHandler(JSON.stringify({ id: "aizen-prompt", type: "prompt", message: "Hello" }));
			await vi.waitFor(() => {
				expect(getPromptResponses(rpcIo.outputLines, "aizen-prompt")).toContainEqual(
					expect.objectContaining({ success: true }),
				);
			});
			expect(prompt).toHaveBeenCalledWith("Hello from transform", { images: undefined });

			lineHandler(JSON.stringify({ id: "aizen-state", type: "get_state" }));
			await vi.waitFor(() => {
				expect(parseOutputLines(rpcIo.outputLines)).toContainEqual(
					expect.objectContaining({
						id: "aizen-state",
						success: true,
						data: expect.objectContaining({ isCompacting: true, pendingMessageCount: 2 }),
					}),
				);
			});

			lineHandler(JSON.stringify({ id: "aizen-switch", type: "switch_session", sessionPath: "other.jsonl" }));
			await vi.waitFor(() => {
				expect(parseOutputLines(rpcIo.outputLines)).toContainEqual(
					expect.objectContaining({
						id: "aizen-switch",
						success: false,
						error: expect.stringContaining("abort the active run first"),
					}),
				);
			});
			expect(runtimeHost.switchSession).not.toHaveBeenCalled();

			lineHandler(JSON.stringify({ id: "aizen-abort", type: "abort" }));
			await vi.waitFor(() => expect(abort).toHaveBeenCalledOnce());
			releasePrompt?.();
			await vi.waitFor(() => {
				expect(parseOutputLines(rpcIo.outputLines)).toContainEqual({ type: "agent_settled" });
			});

			vi.mocked(runtimeHost.session.extensionRunner.emitInput).mockResolvedValue({ action: "continue" });
			lineHandler(JSON.stringify({ id: "aizen-skill", type: "prompt", message: "/skill:rpc-check extra" }));
			await vi.waitFor(() => expect(prompt).toHaveBeenCalledTimes(2));
			expect(prompt.mock.calls[1]?.[0]).toContain("Follow the RPC skill instructions.");
			expect(prompt.mock.calls[1]?.[0]).toContain("extra");
		} finally {
			releasePrompt?.();
			await cleanup();
		}
	});
});
