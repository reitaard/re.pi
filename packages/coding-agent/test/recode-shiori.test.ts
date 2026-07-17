import { describe, expect, it, vi } from "vitest";
import type { ExtensionAPI, ExtensionCommandContext } from "../src/core/extensions/types.ts";
import type { RecodeMemoryManager } from "../src/core/recode-memory/recode-memory-manager.ts";
import {
	buildRecodeShioriReviewChunks,
	getRecodeShioriCheckpoint,
	getRecodeShioriGreeting,
	parseRecodeShioriCandidates,
	RECODE_SHIORI_CHECKPOINT,
	runRecodeShiori,
} from "../src/core/recode-memory/recode-shiori.ts";
import {
	addRecodeShioriResponseFormat,
	getRecodeLmStudioNativeChatUrl,
	runRecodeShioriHarness,
} from "../src/core/recode-memory/recode-shiori-harness.ts";
import type { SessionEntry } from "../src/core/session-manager.ts";
import { normalizeRecodeMemoryConfig } from "../src/recode-memory.ts";

function userEntry(id: string, parentId: string | null, text: string): SessionEntry {
	return {
		type: "message",
		id,
		parentId,
		timestamp: "2026-07-17T00:00:00.000Z",
		message: { role: "user", content: text, timestamp: 0 },
	};
}

describe("Shiori (栞) memory review", () => {
	it("adds a strict memories schema without changing other provider payload fields", () => {
		const payload = addRecodeShioriResponseFormat({ model: "qwen3.5-9b", stream: true }) as Record<string, unknown>;
		expect(payload.model).toBe("qwen3.5-9b");
		expect(payload.stream).toBe(true);
		expect(payload.response_format).toMatchObject({
			type: "json_schema",
			json_schema: {
				name: "repi_shiori_memories",
				strict: true,
				schema: {
					type: "object",
					required: ["memories"],
				},
			},
		});
	});

	it("uses LM Studio native reasoning-off inference only for /v1 base URLs", async () => {
		expect(getRecodeLmStudioNativeChatUrl("http://127.0.0.1:1234/v1")).toBe("http://127.0.0.1:1234/api/v1/chat");
		expect(getRecodeLmStudioNativeChatUrl("https://example.com/openai/v1")).toBeUndefined();

		const fetchMock = vi.fn().mockResolvedValue(
			new Response(
				JSON.stringify({
					output: [{ type: "message", content: '{"memories":[]}' }],
					stats: { reasoning_output_tokens: 0, total_output_tokens: 6 },
				}),
				{ status: 200, headers: { "Content-Type": "application/json" } },
			),
		);
		vi.stubGlobal("fetch", fetchMock);
		try {
			await expect(
				runRecodeShioriHarness({
					cwd: "/project",
					model: {
						id: "qwen3.5-9b",
						name: "Qwen3.5 9B",
						api: "openai-completions",
						provider: "open-provider",
						baseUrl: "http://127.0.0.1:1234/v1",
						reasoning: true,
						input: ["text"],
						cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
						contextWindow: 32768,
						maxTokens: 8192,
					},
					modelRegistry: {
						getApiKeyAndHeaders: vi.fn().mockResolvedValue({
							ok: true,
							apiKey: "test-key",
							headers: { "X-Test": "yes" },
						}),
					} as never,
					systemPrompt: "Review memory.",
					prompt: "Transcript",
					thinking: false,
				}),
			).resolves.toBe('{"memories":[]}');
		} finally {
			vi.unstubAllGlobals();
		}

		expect(fetchMock).toHaveBeenCalledOnce();
		const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
		expect(url).toBe("http://127.0.0.1:1234/api/v1/chat");
		expect(init.headers).toMatchObject({ Authorization: "Bearer test-key", "X-Test": "yes" });
		expect(JSON.parse(String(init.body))).toMatchObject({
			model: "qwen3.5-9b",
			reasoning: "off",
			max_output_tokens: 1024,
			store: false,
		});
	});

	it("greets from the local time without spending a model call", () => {
		expect(getRecodeShioriGreeting(new Date(2026, 6, 17, 8), () => 0)).toBe(
			"Good morning. Your memory is safe within my pages.",
		);
		expect(getRecodeShioriGreeting(new Date(2026, 6, 17, 13), () => 0.2)).toMatch(/^Good afternoon\./);
		expect(getRecodeShioriGreeting(new Date(2026, 6, 17, 20), () => 0.999)).toBe(
			"Good evening. Saved. I won't bring it up unless it's useful.",
		);
	});

	it("defaults to automatic Cardinal routing and preserves explicit choices", () => {
		expect(normalizeRecodeMemoryConfig({}).cardinalRouting).toBe("auto");
		expect(normalizeRecodeMemoryConfig({}).shioriThinking).toBe(false);
		expect(
			normalizeRecodeMemoryConfig({
				shioriThinking: true,
				shioriModel: { provider: "open-provider", id: "qwen3.5-9b" },
			}),
		).toMatchObject({
			shioriThinking: true,
			shioriModel: { provider: "open-provider", id: "qwen3.5-9b" },
		});
		expect(normalizeRecodeMemoryConfig({ cardinalRouting: "ask" }).cardinalRouting).toBe("ask");
		expect(normalizeRecodeMemoryConfig({ shioriRouting: "project" }).cardinalRouting).toBe("project");
		expect(normalizeRecodeMemoryConfig({ cardinalRouting: "invalid" }).cardinalRouting).toBe("auto");
	});

	it("reviews only entries after the latest session checkpoint", () => {
		const first = userEntry("first", null, "Always run focused tests before broad checks.");
		const checkpoint: SessionEntry = {
			type: "custom",
			id: "checkpoint",
			parentId: first.id,
			timestamp: "2026-07-17T00:01:00.000Z",
			customType: RECODE_SHIORI_CHECKPOINT,
			data: {
				lastReviewedEntryId: first.id,
				reviewedAt: "2026-07-17T00:01:00.000Z",
				saved: 1,
			},
		};
		const second = userEntry("second", checkpoint.id, "Use project memory for repository decisions.");
		const branch = [first, checkpoint, second];

		expect(getRecodeShioriCheckpoint(branch)).toMatchObject({ lastReviewedEntryId: "first", saved: 1 });
		const review = buildRecodeShioriReviewChunks(branch);
		expect(review.pendingEntries).toBe(1);
		expect(review.chunks).toHaveLength(1);
		expect(review.chunks[0]?.transcript).toContain("[second] USER");
		expect(review.chunks[0]?.transcript).not.toContain("[first] USER");
	});

	it("accepts fenced JSON, rejects low-confidence noise, normalizes tags, and deduplicates candidates", () => {
		const output = `A discarded draft looked like {memories: pending}. Here is the result:\n\`\`\`json
{
  "memories": [
    {
      "text": "The user prefers focused tests before broad checks.",
      "tags": ["User Preference", "testing"],
      "scope": "global",
      "kind": "preference",
      "confidence": 0.93,
      "evidenceEntryIds": ["entry-a"]
    },
    {
      "text": "The user prefers focused tests before broad checks.",
      "tags": ["testing"],
      "scope": "global",
      "kind": "preference",
      "confidence": 0.91,
      "evidenceEntryIds": ["entry-a"]
    },
    {
      "text": "A weak guess should not persist.",
      "tags": [],
      "scope": "project",
      "kind": "fact",
      "confidence": 0.2,
      "evidenceEntryIds": []
    }
  ]
}
\`\`\``;

		const candidates = parseRecodeShioriCandidates(output);
		expect(candidates).toHaveLength(1);
		expect(candidates[0]).toMatchObject({
			text: "The user prefers focused tests before broad checks.",
			scope: "global",
			kind: "preference",
		});
		expect(candidates[0]?.tags).toEqual(["preference", "testing"]);
	});

	it("ignores overlapping reviews for the same session and releases the lock after failure", async () => {
		let rejectWait: ((error: Error) => void) | undefined;
		let waitCalls = 0;
		const notify = vi.fn();
		const sessionManager = {};
		const ctx = {
			isProjectTrusted: () => true,
			model: {},
			sessionManager,
			ui: { notify },
			waitForIdle: () => {
				waitCalls += 1;
				if (waitCalls > 1) return Promise.reject(new Error("retry reached wait"));
				return new Promise<void>((_resolve, reject) => {
					rejectWait = reject;
				});
			},
		} as unknown as ExtensionCommandContext;
		const options = {
			pi: {} as ExtensionAPI,
			ctx,
			config: normalizeRecodeMemoryConfig({}),
			manager: {} as RecodeMemoryManager,
		};

		const first = runRecodeShiori(options);
		await Promise.resolve();
		await expect(runRecodeShiori(options)).resolves.toBeUndefined();
		expect(notify).toHaveBeenCalledWith("Shiori (栞): A memory review is already running.", "info");

		rejectWait?.(new Error("first review failed"));
		await expect(first).rejects.toThrow("first review failed");
		await expect(runRecodeShiori(options)).rejects.toThrow("retry reached wait");
		expect(waitCalls).toBe(2);
	});
});
