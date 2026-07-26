import { join } from "node:path";
import type { AgentTool } from "@earendil-works/pi-agent-core";
import { Box, Text } from "@earendil-works/pi-tui";
import { getAgentDir } from "../../config.ts";
import type { ExtensionAPI, ExtensionContext } from "../../core/extensions/types.ts";
import { loadSkillsFromDir, type Skill } from "../../core/skills.ts";
import { createToolDefinitionFromAgentTool } from "../../core/tools/tool-definition-wrapper.ts";
import { createRecodeWorkerIndicator, workerForeground } from "../ui/recode-worker-indicator.ts";
import { createDelegateTool } from "./delegate-tool.ts";
import { resolveExternalAgentTools } from "./external-tool-loader.ts";
import type { NamedWorkerDefinition, NamedWorkerSkill } from "./named-worker.ts";
import { WorkerChatController } from "./worker-chat.ts";
import { type WorkerConversationSnapshot, WorkerDirectory } from "./worker-directory.ts";
import { setActiveWorkerHeaderState } from "./worker-header-state.ts";
import { REPI_NAMED_WORKERS } from "./worker-registry.ts";
import { applyWorkerSettingsConfig, readWorkerSettingsConfig } from "./worker-settings.ts";
import { ensureWorkerStorage, inspectWorkerStorage, resolveWorkerStoragePaths } from "./worker-storage.ts";
import { createWorkerControlTools } from "./worker-tools.ts";

const WEB_TOOL_NAMES = ["web_search", "fetch_content", "get_search_content"] as const;
const SETTINGS_FILE = "recode-workers.json";
const CREATOR_MESSAGE_TYPE = "repi.worker.creator";
const WORKER_MESSAGE_TYPE = "repi.worker.reply";

interface WorkerMessageDetails {
	workerId: string;
	workerName: string;
	status?: string;
	conversationId?: string;
}

function toNamedWorkerSkill(skill: Skill): NamedWorkerSkill {
	return {
		name: skill.name,
		description: skill.description,
		filePath: skill.filePath,
		disableModelInvocation: skill.disableModelInvocation,
	};
}

function discoverSessionSkills(cwd: string): NamedWorkerSkill[] {
	const byName = new Map<string, NamedWorkerSkill>();
	for (const skill of loadSkillsFromDir({ dir: join(getAgentDir(), "skills"), source: "user" }).skills) {
		byName.set(skill.name, toNamedWorkerSkill(skill));
	}
	for (const skill of loadSkillsFromDir({ dir: join(cwd, ".pi", "skills"), source: "project" }).skills) {
		byName.set(skill.name, toNamedWorkerSkill(skill));
	}
	return [...byName.values()];
}

function createDirectoryFacade(getDirectory: () => WorkerDirectory | undefined): WorkerDirectory {
	return new Proxy({} as WorkerDirectory, {
		get(_target, property) {
			if (property === "getWorkerDefinitions") return () => REPI_NAMED_WORKERS;
			const directory = getDirectory();
			if (!directory) {
				return () => {
					throw new Error("Worker directory is not ready for the current Recode session");
				};
			}
			const value = Reflect.get(directory, property, directory);
			return typeof value === "function" ? value.bind(directory) : value;
		},
	});
}

function messageText(content: unknown): string {
	if (typeof content === "string") return content;
	if (!Array.isArray(content)) return String(content ?? "");
	return content
		.filter((part): part is { type: "text"; text: string } =>
			Boolean(part && typeof part === "object" && "type" in part && part.type === "text" && "text" in part),
		)
		.map((part) => part.text)
		.join("\n");
}

export function repiWorkers(pi: ExtensionAPI): void {
	let directory: WorkerDirectory | undefined;
	let chat: WorkerChatController | undefined;
	let currentContext: ExtensionContext | undefined;
	let activeWorkerId: string | undefined;
	let loadedSkills: readonly NamedWorkerSkill[] = [];
	let externalTools: readonly AgentTool[] = [];
	let removeTerminalInput: (() => void) | undefined;
	const facade = createDirectoryFacade(() => directory);

	for (const tool of [createDelegateTool({ directory: facade }), ...createWorkerControlTools(facade)]) {
		pi.registerTool(createToolDefinitionFromAgentTool(tool));
	}

	pi.registerMessageRenderer<WorkerMessageDetails>(CREATOR_MESSAGE_TYPE, (message, _options, theme) => {
		const details = message.details;
		const label = details ? `Creator → ${details.workerName}` : "Creator";
		const box = new Box(1, 1, (text) => theme.bg("userMessageBg", text));
		box.addChild(new Text(`${theme.bold(theme.fg("accent", label))}\n${messageText(message.content)}`, 0, 0));
		return box;
	});

	pi.registerMessageRenderer<WorkerMessageDetails>(WORKER_MESSAGE_TYPE, (message, _options, theme) => {
		const details = message.details;
		const workerId = details?.workerId ?? "audit";
		const label = details?.workerName ?? "Worker";
		const status = details?.status ? ` · ${details.status}` : "";
		const box = new Box(1, 1, (text) => theme.bg("customMessageBg", text));
		box.addChild(
			new Text(
				`${theme.bold(workerForeground(workerId, "identity", `${label}${status}`, theme))}\n${messageText(message.content)}`,
				0,
				0,
			),
		);
		return box;
	});

	const refreshExternalTools = async (ctx: ExtensionContext): Promise<void> => {
		try {
			externalTools = await resolveExternalAgentTools(pi, ctx, WEB_TOOL_NAMES);
		} catch {
			externalTools = [];
		}
	};

	const updateWorkerHeader = async (
		worker: NamedWorkerDefinition,
		status: string,
		snapshot?: WorkerConversationSnapshot,
	): Promise<void> => {
		const ctx = currentContext;
		if (!ctx) return;
		const storage = await inspectWorkerStorage(resolveWorkerStoragePaths(getAgentDir(), ctx.cwd, worker));
		setActiveWorkerHeaderState({
			workerId: worker.id,
			workerName: worker.displayName,
			status,
			turnCount: snapshot?.turnCount ?? 0,
			memoryDocumentCount: storage.memoryDocumentCount,
			sessionCount: storage.sessionCount,
			evaluationCount: storage.evaluationCount,
		});
	};

	const exitDirectChat = (ctx: ExtensionContext, notify = true): void => {
		activeWorkerId = undefined;
		setActiveWorkerHeaderState(undefined);
		ctx.ui.setStatus("repi-workers", undefined);
		ctx.ui.setStatus("repi-worker-chat", undefined);
		ctx.ui.setWorkingMessage();
		ctx.ui.setWorkingIndicator();
		if (notify) ctx.ui.notify("Returned to Aizen", "info");
	};

	const sendDirectMessage = async (
		worker: NamedWorkerDefinition,
		text: string,
		ctx: ExtensionContext,
	): Promise<void> => {
		if (!chat) throw new Error("Direct worker chat is not ready");
		pi.sendMessage(
			{
				customType: CREATOR_MESSAGE_TYPE,
				content: text,
				display: true,
				details: { workerId: worker.id, workerName: worker.displayName },
			},
			{ triggerTurn: false },
		);
		await updateWorkerHeader(worker, "running");
		ctx.ui.setWorkingMessage("");
		ctx.ui.setWorkingIndicator(createRecodeWorkerIndicator(worker.id, worker.displayName, ctx.ui.theme));
		try {
			const turn = await chat.send(worker.id, text, ctx.signal);
			const output = turn.result.output || turn.result.error || `[${turn.result.status}]`;
			pi.sendMessage(
				{
					customType: WORKER_MESSAGE_TYPE,
					content: output,
					display: true,
					details: {
						workerId: worker.id,
						workerName: worker.displayName,
						status: turn.result.status,
						conversationId: turn.conversation.conversationId,
					},
				},
				{ triggerTurn: false },
			);
			await updateWorkerHeader(worker, turn.result.status, turn.conversation);
		} finally {
			ctx.ui.setWorkingMessage();
			ctx.ui.setWorkingIndicator();
		}
	};

	const createDirectory = async (ctx: ExtensionContext): Promise<void> => {
		chat?.clear();
		directory?.closeAll();
		currentContext = ctx;
		activeWorkerId = undefined;
		setActiveWorkerHeaderState(undefined);
		ctx.ui.setStatus("repi-workers", undefined);
		ctx.ui.setStatus("repi-worker-chat", undefined);
		loadedSkills = discoverSessionSkills(ctx.cwd);
		await refreshExternalTools(ctx);
		directory = new WorkerDirectory({
			cwd: ctx.cwd,
			workers: REPI_NAMED_WORKERS,
			getModel: () => currentContext?.model,
			getSkills: () => loadedSkills,
			getExternalTools: (worker) =>
				(worker.tools ?? []).some((name) => WEB_TOOL_NAMES.includes(name as (typeof WEB_TOOL_NAMES)[number]))
					? externalTools
					: [],
			modelRegistry: ctx.modelRegistry,
		});
		chat = new WorkerChatController(directory);
		await ensureWorkerStorage(getAgentDir(), ctx.cwd, REPI_NAMED_WORKERS);
		applyWorkerSettingsConfig(directory, await readWorkerSettingsConfig(join(getAgentDir(), SETTINGS_FILE)));
	};

	pi.registerCommand("worker", {
		description: "Enter direct chat with Mayuri or Levi: /worker <name> [message]",
		handler: async (args, ctx) => {
			if (!directory) throw new Error("Worker directory is not ready");
			const [reference, ...messageParts] = args.trim().split(/\s+/).filter(Boolean);
			if (!reference) {
				ctx.ui.notify("Usage: /worker <Mayuri|Levi> [message]", "info");
				return;
			}
			if (["exit", "off", "aizen"].includes(reference.toLowerCase())) {
				exitDirectChat(ctx);
				return;
			}
			const worker = directory.resolveWorker(reference);
			activeWorkerId = worker.id;
			await updateWorkerHeader(worker, "ready");
			ctx.ui.notify(`Direct chat with ${worker.displayName}. Esc or /worker-exit returns to Aizen.`, "info");
			const initialMessage = messageParts.join(" ").trim();
			if (initialMessage) await sendDirectMessage(worker, initialMessage, ctx);
		},
	});

	pi.registerCommand("worker-exit", {
		description: "Exit direct worker chat and return to Aizen",
		handler: async (_args, ctx) => exitDirectChat(ctx),
	});

	pi.on("input", async (event, ctx) => {
		if (ctx.mode !== "tui" || event.source !== "interactive" || !activeWorkerId) return { action: "continue" };
		if (event.text.startsWith("/")) return { action: "continue" };
		if (!directory) return { action: "handled" };
		if (event.images?.length) {
			ctx.ui.notify("Direct worker chat currently accepts text only", "warning");
			return { action: "handled" };
		}
		const worker = directory.resolveWorker(activeWorkerId);
		await sendDirectMessage(worker, event.text, ctx);
		return { action: "handled" };
	});

	pi.on("session_start", async (_event, ctx) => {
		await createDirectory(ctx);
		removeTerminalInput?.();
		removeTerminalInput = ctx.ui.onTerminalInput((data) => {
			if (data !== "\x1b" || !activeWorkerId || !directory) return undefined;
			const worker = directory.resolveWorker(activeWorkerId);
			const conversationId = chat?.getConversationId(worker.id);
			const snapshot = conversationId ? directory.getStatus(conversationId)[0] : undefined;
			if (snapshot?.status === "running" && conversationId) {
				directory.cancelConversation(conversationId);
				ctx.ui.notify(`Cancellation requested for ${worker.displayName}`, "warning");
				return { consume: true };
			}
			exitDirectChat(ctx);
			return { consume: true };
		});
	});

	pi.on("before_agent_start", async (event, ctx) => {
		currentContext = ctx;
		loadedSkills = (event.systemPromptOptions.skills ?? []).map(toNamedWorkerSkill);
		if (externalTools.length === 0) await refreshExternalTools(ctx);
		if (directory) {
			directory.updateRuntime({
				getModel: () => currentContext?.model,
				getSkills: () => loadedSkills,
				getExternalTools: (worker) =>
					(worker.tools ?? []).some((name) => WEB_TOOL_NAMES.includes(name as (typeof WEB_TOOL_NAMES)[number]))
						? externalTools
						: [],
				modelRegistry: ctx.modelRegistry,
			});
		}
	});

	pi.on("session_shutdown", () => {
		removeTerminalInput?.();
		removeTerminalInput = undefined;
		chat?.clear();
		chat = undefined;
		directory?.closeAll();
		directory = undefined;
		currentContext = undefined;
		activeWorkerId = undefined;
		setActiveWorkerHeaderState(undefined);
	});
}
