import { type AgentEvent, AgentHarness, Session } from "@reitaard/repi-agent-core";
import { NodeExecutionEnv } from "@reitaard/repi-agent-core/node";
import type { AssistantMessage, ImageContent, Models } from "@reitaard/repi-ai";
import { isContextOverflow, isRetryableAssistantError } from "@reitaard/repi-ai/compat";
import { sleep } from "../utils/sleep.ts";
import type {
	AgentSession,
	AgentSessionEvent,
	AgentSessionEventListener,
	AizenRuntimeProfile,
} from "./agent-session.ts";
import { calculateContextTokens, shouldCompact } from "./compaction/index.ts";
import { createHarnessModels } from "./harness-models.ts";
import { RecodeSessionStorage } from "./recode-session-storage.ts";

export interface AizenRuntime {
	harness: AgentHarness;
	profile: AizenRuntimeProfile;
	session: Session;
	prompt(text: string, options?: { images?: ImageContent[] }): Promise<AssistantMessage>;
	subscribe(listener: AgentSessionEventListener): () => void;
}

export interface CreateAizenRuntimeOptions {
	agentSession: AgentSession;
	cwd: string;
	/** Test/application override. Production resolves the locked model through RePi's registry. */
	models?: Models;
}

/** Build one Aizen runtime from RePi-owned configuration and session state. */
export function createAizenRuntime(options: CreateAizenRuntimeOptions): AizenRuntime {
	const profile = options.agentSession.createAizenRuntimeProfile();
	const { hooks, ...harnessProfile } = profile;
	const session = new Session(new RecodeSessionStorage(options.agentSession.sessionManager));
	const models =
		options.models ??
		createHarnessModels(
			profile.model,
			options.agentSession.modelRegistry,
			"Aizen runtime",
			hooks.beforeProviderHeaders,
		);
	const harness = new AgentHarness({
		env: new NodeExecutionEnv({ cwd: options.cwd }),
		session,
		models,
		...harnessProfile,
	});
	harness.on("before_agent_start", hooks.beforeAgentStart);
	harness.on("context", hooks.context);
	harness.on("before_provider_payload", hooks.beforeProviderPayload);
	harness.on("after_provider_response", hooks.afterProviderResponse);
	harness.on("tool_call", hooks.toolCall);
	harness.on("tool_result", hooks.toolResult);
	const listeners = new Set<AgentSessionEventListener>();
	const emit = (event: AgentSessionEvent): void => {
		for (const listener of listeners) listener(event);
	};
	let pendingAgentEnd: Extract<AgentEvent, { type: "agent_end" }> | undefined;
	let activeCompaction: { reason: "threshold" | "overflow"; willRetry: boolean } | undefined;
	const flushAgentEnd = (willRetry: boolean): void => {
		if (!pendingAgentEnd) return;
		emit({ ...pendingAgentEnd, willRetry });
		pendingAgentEnd = undefined;
	};
	harness.subscribe(async (event) => {
		if (event.type === "session_compact" && activeCompaction) {
			emit({
				type: "compaction_end",
				reason: activeCompaction.reason,
				result: undefined,
				aborted: false,
				willRetry: activeCompaction.willRetry,
			});
			activeCompaction = undefined;
			return;
		}
		if (!isAgentLifecycleEvent(event)) return;
		await hooks.lifecycle?.(event);
		if (event.type === "agent_end") pendingAgentEnd = event;
		else emit(event);
	});
	const recovery = profile.recovery ?? {
		compaction: { enabled: false, reserveTokens: 16384, keepRecentTokens: 20000 },
		retry: { enabled: false, maxRetries: 0, baseDelayMs: 2000 },
	};

	const prompt = async (text: string, promptOptions?: { images?: ImageContent[] }): Promise<AssistantMessage> => {
		let retryAttempt = 0;
		try {
			let response = await harness.prompt(text, promptOptions);
			let overflowRecoveryAttempted = false;

			while (response.stopReason === "error") {
				if (isContextOverflow(response, profile.model.contextWindow)) {
					if (overflowRecoveryAttempted || !recovery.compaction.enabled) break;
					overflowRecoveryAttempted = true;
					flushAgentEnd(true);
					emit({ type: "compaction_start", reason: "overflow" });
					activeCompaction = { reason: "overflow", willRetry: true };
					try {
						response = await harness.retry({ compact: { settings: recovery.compaction } });
					} catch (error) {
						if (activeCompaction) {
							emit({
								type: "compaction_end",
								reason: "overflow",
								result: undefined,
								aborted: false,
								willRetry: false,
								errorMessage: error instanceof Error ? error.message : String(error),
							});
							activeCompaction = undefined;
						}
						throw error;
					}
					continue;
				}
				if (!recovery.retry.enabled || !isRetryableAssistantError(response)) break;
				if (retryAttempt >= recovery.retry.maxRetries) break;
				flushAgentEnd(true);
				const delayMs = recovery.retry.baseDelayMs * 2 ** retryAttempt;
				retryAttempt++;
				emit({
					type: "auto_retry_start",
					attempt: retryAttempt,
					maxAttempts: recovery.retry.maxRetries,
					delayMs,
					errorMessage: response.errorMessage || "Unknown error",
				});
				await sleep(delayMs);
				response = await harness.retry();
			}

			flushAgentEnd(false);
			if (retryAttempt > 0) {
				emit({
					type: "auto_retry_end",
					success: response.stopReason !== "error",
					attempt: retryAttempt,
					finalError: response.stopReason === "error" ? response.errorMessage : undefined,
				});
			}

			if (
				recovery.compaction.enabled &&
				response.stopReason !== "aborted" &&
				response.usage &&
				shouldCompact(calculateContextTokens(response.usage), profile.model.contextWindow, recovery.compaction)
			) {
				emit({ type: "compaction_start", reason: "threshold" });
				activeCompaction = { reason: "threshold", willRetry: false };
				try {
					await harness.compact(undefined, recovery.compaction);
				} catch (error) {
					if (activeCompaction) {
						emit({
							type: "compaction_end",
							reason: "threshold",
							result: undefined,
							aborted: false,
							willRetry: false,
							errorMessage: error instanceof Error ? error.message : String(error),
						});
						activeCompaction = undefined;
					}
				}
			}

			return response;
		} finally {
			flushAgentEnd(false);
			await hooks.settled?.();
			emit({ type: "agent_settled" });
		}
	};

	return {
		harness,
		profile,
		session,
		prompt,
		subscribe: (listener) => {
			listeners.add(listener);
			return () => listeners.delete(listener);
		},
	};
}

function isAgentLifecycleEvent(event: { type: string }): event is AgentEvent {
	return (
		event.type === "agent_start" ||
		event.type === "agent_end" ||
		event.type === "turn_start" ||
		event.type === "turn_end" ||
		event.type === "message_start" ||
		event.type === "message_update" ||
		event.type === "message_end" ||
		event.type === "tool_execution_start" ||
		event.type === "tool_execution_update" ||
		event.type === "tool_execution_end"
	);
}
