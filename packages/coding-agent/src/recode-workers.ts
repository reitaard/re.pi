import { join } from "node:path";
import type { ThinkingLevel } from "@reitaard/repi-agent-core";
import {
	type Component,
	Container,
	Loader,
	Markdown,
	Spacer,
	Text,
	truncateToWidth,
	visibleWidth,
} from "@reitaard/repi-tui";
import { getAgentDir } from "./config.ts";
import { formatNamedWorkerIdentity, type NamedWorkerDefinition } from "./core/delegation/named-worker.ts";
import {
	formatOrchestrationActor,
	REPI_AIZEN_IDENTITY,
	REPI_CREATOR_IDENTITY,
} from "./core/delegation/orchestration-identity.ts";
import { WorkerChatController } from "./core/delegation/worker-chat.ts";
import type {
	WorkerConversationRestoreTurn,
	WorkerConversationSnapshot,
	WorkerConversationTurnResult,
	WorkerDescriptor,
	WorkerDirectory,
} from "./core/delegation/worker-directory.ts";
import {
	applyWorkerSettingsConfig,
	type PersistedWorkerSettingsConfig,
	readWorkerSettingsConfig,
	writeWorkerSettingsConfig,
} from "./core/delegation/worker-settings.ts";
import type {
	ExtensionAPI,
	ExtensionCommandContext,
	ToolDefinition,
	ToolRenderContext,
} from "./core/extensions/types.ts";
import type { SessionEntry } from "./core/session-manager.ts";
import {
	createRecodeWorkerIndicator,
	creatorForeground,
	workerForeground,
	workerStarFrame,
} from "./modes/interactive/components/recode-worker-indicator.ts";
import {
	type RecodeWorkerSettingId,
	RecodeWorkerSettingsComponent,
} from "./modes/interactive/components/recode-worker-settings.ts";
import { getMarkdownTheme, type Theme } from "./modes/interactive/theme/theme.ts";

const WORKER_HANDOFF_ENTRY = "recode-worker-handoff";
const CREATOR_MESSAGE_ENTRY = "recode-creator-worker-message";
const WORKER_WIDGET_PREFIX = "recode-worker-active";
const WORKER_TOOL_ANIMATION_INTERVAL_MS = 90;
const AIZEN_IDENTITY = formatOrchestrationActor(REPI_AIZEN_IDENTITY);
const CURRENT_MODEL_LABEL = "current (follows Aizen)";
export interface RecodeWorkersOptions {
	settingsPath?: string;
}

export type WorkerPresentationMode = "direct" | "delegated";

export interface WorkerHandoffEntry {
	mode?: WorkerPresentationMode;
	workerId: string;
	workerName: string;
	workerAliases?: readonly string[];
	status: WorkerConversationTurnResult["result"]["status"];
	output: string;
	error?: string;
	harnessSetupDurationMs: number;
	durationMs: number;
	turnCount: number;
	conversationId?: string;
	runId?: string;
	speaker?: WorkerConversationSnapshot["speaker"];
	message?: string;
	createdAt?: number;
	updatedAt?: number;
}

interface CreatorMessageEntry {
	message: string;
}

const WORKER_ACTIVITY_PHRASES: Readonly<Record<string, readonly string[]>> = {
	research: ["following the trail", "cross-checking the sources", "organizing the findings"],
	audit: ["checking the boundary", "reviewing the evidence", "tightening the report"],
};

function stableHash(value: string): number {
	let hash = 0;
	for (const character of value) hash = (hash * 31 + (character.codePointAt(0) ?? 0)) >>> 0;
	return hash;
}

function identity(worker: Pick<NamedWorkerDefinition, "displayName" | "aliases">): string {
	return formatNamedWorkerIdentity(worker);
}

function durationText(durationMs: number): string {
	if (durationMs < 1_000) return `${durationMs.toFixed(0)} ms`;
	if (durationMs < 60_000) return `${(durationMs / 1_000).toFixed(1)} s`;
	const minutes = Math.floor(durationMs / 60_000);
	const seconds = Math.floor((durationMs % 60_000) / 1_000);
	return `${minutes}m ${seconds.toString().padStart(2, "0")}s`;
}

function latestWorkerStatus(directory: WorkerDirectory, workerId: string): WorkerConversationSnapshot | undefined {
	return directory.getStatus().find((snapshot) => snapshot.workerId === workerId);
}

export function workerActivityText(
	worker: NamedWorkerDefinition,
	mode: WorkerPresentationMode,
	turnNumber: number,
): string {
	const phrases = WORKER_ACTIVITY_PHRASES[worker.id] ?? ["working through the request"];
	const phrase = phrases[stableHash(`${worker.id}:${mode}:${turnNumber}`) % phrases.length] ?? phrases[0];
	const destination = mode === "delegated" ? ` for ${AIZEN_IDENTITY}` : "";
	return `${identity(worker)} is ${phrase}${destination}…`;
}

export function workerRouteLabel(workerIdentity: string, mode: WorkerPresentationMode): string {
	return mode === "delegated" ? `${workerIdentity} → ${AIZEN_IDENTITY} · handoff` : `${workerIdentity} · direct chat`;
}

export function settleWorkerActivity(clearActivity: () => void, appendResult: () => void): void {
	clearActivity();
	appendResult();
}

export function workerActivityWidgetKey(workerId: string): string {
	return `${WORKER_WIDGET_PREFIX}:${workerId}`;
}

export function formatCreatorMessage(message: string): string {
	return `${formatOrchestrationActor(REPI_CREATOR_IDENTITY)}: ${JSON.stringify(message)}`;
}

function handoffMessage(
	turn: WorkerConversationTurnResult,
	mode: WorkerPresentationMode,
	message?: string,
): WorkerHandoffEntry {
	return {
		mode,
		workerId: turn.result.workerId,
		workerName: turn.result.workerName,
		workerAliases: turn.result.workerAliases,
		status: turn.result.status,
		output: turn.result.output,
		error: turn.result.error,
		harnessSetupDurationMs: turn.result.harnessSetupDurationMs,
		durationMs: turn.result.durationMs,
		turnCount: turn.conversation.turnCount,
		...(mode === "direct" && message
			? {
					conversationId: turn.conversation.conversationId,
					runId: turn.result.runId,
					speaker: turn.conversation.speaker,
					message: message.trim(),
					createdAt: turn.conversation.createdAt,
					updatedAt: turn.conversation.updatedAt,
				}
			: {}),
	};
}

function isRestorableDirectHandoff(entry: WorkerHandoffEntry): boolean {
	return Boolean(
		entry.mode === "direct" &&
			entry.conversationId &&
			entry.runId &&
			entry.speaker &&
			entry.message?.trim() &&
			entry.createdAt !== undefined &&
			entry.updatedAt !== undefined,
	);
}

export function restoreDirectWorkerChats(
	entries: readonly SessionEntry[],
	chat: WorkerChatController,
	directory: WorkerDirectory,
): void {
	for (const entry of entries) {
		if (entry.type !== "custom" || entry.customType !== WORKER_HANDOFF_ENTRY || !entry.data) continue;
		const data = entry.data as WorkerHandoffEntry;
		if (!isRestorableDirectHandoff(data)) continue;
		const restoreTurn: WorkerConversationRestoreTurn = {
			conversationId: data.conversationId!,
			workerId: data.workerId,
			speaker: data.speaker!,
			message: data.message!,
			result: {
				runId: data.runId!,
				workerId: data.workerId,
				workerName: data.workerName,
				workerAliases: data.workerAliases,
				status: data.status,
				output: data.output,
				error: data.error,
				harnessSetupDurationMs: data.harnessSetupDurationMs,
				durationMs: data.durationMs,
				truncated: false,
			},
			createdAt: data.createdAt!,
			updatedAt: data.updatedAt!,
			turnCount: data.turnCount,
		};
		directory.restoreConversationTurn(restoreTurn);
		chat.restore(data.workerId, data.conversationId!);
	}
}

function isWorkerTurn(value: unknown): value is WorkerConversationTurnResult {
	if (!value || typeof value !== "object") return false;
	const candidate = value as { conversation?: unknown; result?: unknown };
	return Boolean(candidate.conversation && candidate.result);
}

function isWorkerHandoff(value: unknown): value is { result: WorkerConversationTurnResult["result"] } {
	if (!value || typeof value !== "object") return false;
	const candidate = value as { result?: { workerId?: unknown; workerName?: unknown } };
	return typeof candidate.result?.workerId === "string" && typeof candidate.result.workerName === "string";
}

function isWorkerRoster(value: unknown): value is { workers: WorkerDescriptor[] } {
	if (!value || typeof value !== "object") return false;
	return Array.isArray((value as { workers?: unknown }).workers);
}

function isWorkerStatus(value: unknown): value is { conversations: WorkerConversationSnapshot[] } {
	if (!value || typeof value !== "object") return false;
	return Array.isArray((value as { conversations?: unknown }).conversations);
}

function isClosedWorker(value: unknown): value is { conversation: WorkerConversationSnapshot } {
	if (!value || typeof value !== "object") return false;
	return Boolean((value as { conversation?: unknown }).conversation);
}

function isCancellation(value: unknown): value is { cancelled: boolean } {
	if (!value || typeof value !== "object") return false;
	return typeof (value as { cancelled?: unknown }).cancelled === "boolean";
}

function textContent(content: readonly { type: string; text?: string }[]): string {
	return content
		.filter((item): item is { type: string; text: string } => item.type === "text" && typeof item.text === "string")
		.map((item) => item.text)
		.join("\n");
}

function workerLoader(
	ctx: ExtensionCommandContext,
	worker: NamedWorkerDefinition,
	mode: WorkerPresentationMode,
	turnNumber: number,
): void {
	ctx.ui.setWidget(workerActivityWidgetKey(worker.id), (tui, theme) => {
		const loader = new Loader(
			tui,
			(text) => text,
			(text) => text,
			"",
			createRecodeWorkerIndicator(worker.id, workerActivityText(worker, mode, turnNumber), theme),
		);
		return {
			render: (width) => loader.render(width).slice(1),
			invalidate: () => loader.invalidate(),
			dispose: () => loader.stop(),
		};
	});
}

async function sendDirectMessage(
	pi: ExtensionAPI,
	chat: WorkerChatController,
	directory: WorkerDirectory,
	ctx: ExtensionCommandContext,
	workerReference: string,
	message?: string,
): Promise<void> {
	const worker = directory.resolveWorker(workerReference);
	const prompt = message?.trim() || (await ctx.ui.input(`Direct chat · ${identity(worker)}`, "Write a message"));
	if (!prompt?.trim()) return;
	pi.appendEntry(CREATOR_MESSAGE_ENTRY, {
		message: prompt.trim(),
	} satisfies CreatorMessageEntry);
	await ctx.waitForIdle();
	const turnNumber = (latestWorkerStatus(directory, worker.id)?.turnCount ?? 0) + 1;
	const widgetKey = workerActivityWidgetKey(worker.id);
	workerLoader(ctx, worker, "direct", turnNumber);
	try {
		const turn = await chat.send(worker.id, prompt, ctx.signal);
		settleWorkerActivity(
			() => ctx.ui.setWidget(widgetKey, undefined),
			() => {
				if (!pi.getSessionName() && !ctx.sessionManager.getEntries().some((entry) => entry.type === "message")) {
					pi.setSessionName("Worker direct chats");
				}
				pi.appendEntry(WORKER_HANDOFF_ENTRY, handoffMessage(turn, "direct", prompt), {
					persistImmediately: true,
				});
			},
		);
	} finally {
		ctx.ui.setWidget(widgetKey, undefined);
	}
}

async function showWorkerPage(
	pi: ExtensionAPI,
	chat: WorkerChatController,
	directory: WorkerDirectory,
	ctx: ExtensionCommandContext,
	config: PersistedWorkerSettingsConfig,
	updateConfig: (next: PersistedWorkerSettingsConfig) => Promise<void>,
): Promise<void> {
	const availableModels = ctx.modelRegistry.getAvailable();
	const modelValues = availableModels.map((model) => `${model.provider}/${model.id}`);
	let activeConfig = config;
	const selected = await ctx.ui.custom<{ workerId: string; action: "chat" } | undefined>(
		(tui, _activeTheme, _keybindings, done) => {
			let pending = Promise.resolve();
			const applyChange = async (id: RecodeWorkerSettingId, value: string): Promise<void> => {
				const worker = directory.resolveWorker(id.workerId);
				if (id.action === "chat") {
					done({ workerId: worker.id, action: "chat" });
					return;
				}
				if (id.action === "close") {
					ctx.ui.notify(
						chat.close(worker.id) ? `${identity(worker)} direct chat closed.` : "No open direct chat.",
						"info",
					);
					return;
				}
				if (id.action === "status") {
					const status = latestWorkerStatus(directory, worker.id);
					ctx.ui.notify(
						status
							? `${identity(worker)}: ${status.status} · ${status.turnCount} ${status.turnCount === 1 ? "turn" : "turns"} · ${durationText(status.elapsedMs)}`
							: `${identity(worker)}: ready · no direct conversation`,
						"info",
					);
					return;
				}
				if (id.action === "tools") {
					ctx.ui.notify(
						`${identity(worker)} read-only tools: ${(worker.tools ?? ["read", "grep", "find", "ls"]).join(", ")}`,
						"info",
					);
					return;
				}
				if (id.action === "prompt") {
					ctx.ui.notify(
						[worker.description, worker.personality, worker.systemPrompt]
							.filter((item): item is string => Boolean(item))
							.join("\n\n"),
						"info",
					);
					return;
				}

				const persisted = { ...(activeConfig[worker.id] ?? {}) };
				if (id.action === "model") {
					if (value === CURRENT_MODEL_LABEL) delete persisted.modelPreference;
					else {
						const model = availableModels.find((candidate) => `${candidate.provider}/${candidate.id}` === value);
						if (!model) throw new Error(`Worker model is unavailable: ${value}`);
						persisted.modelPreference = { provider: model.provider, id: model.id };
					}
				} else if (id.action === "thinking") {
					persisted.thinkingLevel = value as ThinkingLevel;
				} else if (id.action === "tokens") {
					persisted.maxOutputTokens = Number.parseInt(value, 10);
				}
				const next = { ...activeConfig, [worker.id]: persisted };
				await updateConfig(next);
				activeConfig = next;
			};

			const component = new RecodeWorkerSettingsComponent(
				{
					workers: directory.listWorkers(),
					directChats: new Map(
						directory.getWorkerDefinitions().flatMap((worker) => {
							const conversationId = chat.getConversationId(worker.id);
							const snapshot = conversationId ? directory.getStatus(conversationId)[0] : undefined;
							return snapshot ? [[worker.id, snapshot] as const] : [];
						}),
					),
					modelValues,
					maxVisible: Math.max(4, Math.min(9, tui.terminal.rows - 10)),
				},
				(id, value) => {
					pending = pending
						.catch(() => {})
						.then(() => applyChange(id, value))
						.catch((error: unknown) => {
							ctx.ui.notify(
								`Worker settings failed: ${error instanceof Error ? error.message : String(error)}`,
								"error",
							);
						});
				},
				() => void pending.finally(() => done(undefined)),
			);
			return component;
		},
	);
	if (selected?.action === "chat") await sendDirectMessage(pi, chat, directory, ctx, selected.workerId);
}

function resolveCallWorker(
	directory: WorkerDirectory,
	args: Record<string, unknown>,
): NamedWorkerDefinition | undefined {
	if (typeof args.worker === "string") return directory.resolveWorker(args.worker);
	if (typeof args.conversationId === "string") {
		try {
			const snapshot = directory.getStatus(args.conversationId)[0];
			return snapshot ? directory.resolveWorker(snapshot.workerId) : undefined;
		} catch {
			return undefined;
		}
	}
	return undefined;
}

interface WorkerCallRenderState {
	frameIndex?: number;
	interval?: ReturnType<typeof setInterval>;
}

export function renderWorkerCall(
	directory: WorkerDirectory,
	toolName: string,
	args: Record<string, unknown>,
	theme: Theme,
	context?: ToolRenderContext,
): Container {
	const container = new Container();
	const worker = resolveCallWorker(directory, args);
	const state = context?.state as WorkerCallRenderState | undefined;
	if (state && context) {
		if (context.isPartial && !state.interval) {
			state.frameIndex ??= 0;
			state.interval = setInterval(() => {
				state.frameIndex = (state.frameIndex ?? 0) + 1;
				context.invalidate();
			}, WORKER_TOOL_ANIMATION_INTERVAL_MS);
		} else if (!context.isPartial && state.interval) {
			clearInterval(state.interval);
			state.interval = undefined;
		}
	}
	const frameIndex = state?.frameIndex ?? 0;
	if (!worker) {
		if (toolName === "worker_list") {
			container.addChild(
				new Text(`${workerStarFrame(frameIndex, theme)} ${theme.fg("mdLink", "worker roster")}`, 0, 0),
			);
		} else {
			container.addChild(
				new Text(
					`${workerStarFrame(frameIndex, theme)} ${theme.fg("mdLink", toolName.replaceAll("_", " "))}`,
					0,
					0,
				),
			);
		}
		return container;
	}
	const purpose = toolName === "delegate" ? "brief" : "handoff";
	if (context?.isPartial) {
		const frames =
			createRecodeWorkerIndicator(worker.id, `${workerActivityText(worker, "delegated", 1)} · ${purpose}`, theme)
				.frames ?? [];
		container.addChild(new Text(frames[frameIndex % Math.max(1, frames.length)] ?? "", 0, 0));
		return container;
	}
	container.addChild(
		new Text(
			`${workerStarFrame(0, theme)} ${workerForeground(
				worker.id,
				"identity",
				`${workerActivityText(worker, "delegated", 1)} · ${purpose}`,
				theme,
			)}`,
			0,
			0,
		),
	);
	return container;
}

export function renderRoster(workers: readonly WorkerDescriptor[], theme: Theme): Container {
	const container = new Container();
	for (const [index, worker] of workers.entries()) {
		if (index > 0) container.addChild(new Spacer(1));
		const field = (label: string, value: string): Text =>
			new Text(
				`${workerForeground(worker.id, "rail", "•", theme)} ${theme.bold(
					workerForeground(worker.id, "identity", `${label}:`, theme),
				)} ${workerForeground(worker.id, "text", value, theme)}`,
				0,
				0,
			);
		container.addChild(
			new Text(theme.bold(workerForeground(worker.id, "identity", `✦ ${identity(worker)}`, theme)), 0, 0),
		);
		container.addChild(field("id", worker.id));
		container.addChild(field("name", identity(worker)));
		container.addChild(field("role", worker.description));
		container.addChild(field("persona", worker.personality ?? "Purpose-led and concise."));
		container.addChild(field("tools", worker.tools.join(", ")));
	}
	return container;
}

export function renderStatuses(conversations: readonly WorkerConversationSnapshot[], theme: Theme): Container {
	const container = new Container();
	if (conversations.length === 0) {
		container.addChild(new Text(theme.fg("muted", "No worker conversations."), 0, 0));
		return container;
	}
	for (const snapshot of conversations) {
		const workerIdentity = formatNamedWorkerIdentity({
			displayName: snapshot.workerName,
			aliases: snapshot.workerAliases,
		});
		const exceptionalStatus = snapshot.status === "completed" ? "" : ` · ${snapshot.status}`;
		container.addChild(
			new Text(
				theme.bold(
					workerForeground(snapshot.workerId, "identity", `✦ ${workerIdentity}${exceptionalStatus}`, theme),
				),
				0,
				0,
			),
		);
		container.addChild(
			new Text(
				theme.fg(
					"muted",
					`${snapshot.turnCount} ${snapshot.turnCount === 1 ? "turn" : "turns"} · ${durationText(snapshot.elapsedMs)} · ${snapshot.taskSummary}`,
				),
				0,
				0,
			),
		);
	}
	return container;
}

/** Add worker-specific TUI presentation without changing the underlying tool protocol. */
export function withWorkerToolPresentation(definition: ToolDefinition, directory: WorkerDirectory): ToolDefinition {
	if (
		![
			"delegate",
			"worker_list",
			"worker_start",
			"worker_message",
			"worker_status",
			"worker_cancel",
			"worker_close",
		].includes(definition.name)
	) {
		return definition;
	}
	return {
		...definition,
		renderShell: "self",
		renderCall: (args, theme, context) =>
			renderWorkerCall(directory, definition.name, args as Record<string, unknown>, theme, context),
		renderResult: (result, _options, theme) => {
			if (isWorkerTurn(result.details)) return renderHandoff(handoffMessage(result.details, "delegated"), theme);
			if (isWorkerHandoff(result.details)) {
				return renderHandoff(
					{
						mode: "delegated",
						workerId: result.details.result.workerId,
						workerName: result.details.result.workerName,
						workerAliases: result.details.result.workerAliases,
						status: result.details.result.status,
						output: result.details.result.output,
						error: result.details.result.error,
						harnessSetupDurationMs: result.details.result.harnessSetupDurationMs,
						durationMs: result.details.result.durationMs,
						turnCount: 1,
					},
					theme,
				);
			}
			if (isWorkerRoster(result.details)) return renderRoster(result.details.workers, theme);
			if (isWorkerStatus(result.details)) return renderStatuses(result.details.conversations, theme);
			if (isClosedWorker(result.details)) {
				const rendered = renderStatuses([result.details.conversation], theme);
				rendered.addChild(new Text(theme.fg("muted", "Conversation closed."), 0, 0));
				return rendered;
			}
			if (isCancellation(result.details)) {
				const container = new Container();
				container.addChild(
					new Text(
						theme.fg(
							result.details.cancelled ? "warning" : "muted",
							result.details.cancelled ? "Cancellation requested." : "No active worker turn.",
						),
						0,
						0,
					),
				);
				return container;
			}
			const container = new Container();
			container.addChild(new Markdown(textContent(result.content), 0, 0, getMarkdownTheme()));
			return container;
		},
	};
}

export class WorkerResultCard implements Component {
	private readonly entry: WorkerHandoffEntry;
	private readonly activeTheme: Theme;

	constructor(entry: WorkerHandoffEntry, activeTheme: Theme) {
		this.entry = entry;
		this.activeTheme = activeTheme;
	}

	render(width: number): string[] {
		const workerIdentity = formatNamedWorkerIdentity({
			displayName: this.entry.workerName,
			aliases: this.entry.workerAliases,
		});
		const route = workerRouteLabel(workerIdentity, this.entry.mode === "delegated" ? "delegated" : "direct");
		if (width < 5) {
			return [
				truncateToWidth(
					workerForeground(this.entry.workerId, "identity", `│${route}`, this.activeTheme),
					width,
					"",
				),
			];
		}
		const cardWidth = width;
		const contentWidth = cardWidth - 4;
		const rail = workerForeground(this.entry.workerId, "rail", "│", this.activeTheme);
		const wrap = (line: string): string => {
			const clipped = truncateToWidth(line, contentWidth, "");
			const rendered = `${rail} ${clipped}${" ".repeat(Math.max(0, contentWidth - visibleWidth(clipped)))} ${rail}`;
			return this.entry.mode === "direct" ? this.activeTheme.bg("customMessageBg", rendered) : rendered;
		};
		const title = this.activeTheme.bold(
			workerForeground(this.entry.workerId, "identity", `✦ ${route}`, this.activeTheme),
		);
		const durationColor = this.entry.status === "completed" ? "toolSuccessStatus" : "toolErrorStatus";
		const duration = this.activeTheme.fg(
			durationColor,
			this.entry.status === "completed"
				? durationText(this.entry.durationMs)
				: `${this.entry.status} · ${durationText(this.entry.durationMs)}`,
		);
		const titleGap = contentWidth - visibleWidth(title) - visibleWidth(duration);
		const lines =
			titleGap >= 2 ? [wrap(`${title}${" ".repeat(titleGap)}${duration}`)] : [wrap(title), wrap(duration)];
		lines.push(
			wrap(
				this.activeTheme.fg(
					"muted",
					`${this.entry.turnCount} ${this.entry.turnCount === 1 ? "turn" : "turns"} · setup ${this.entry.harnessSetupDurationMs.toFixed(2)} ms`,
				),
			),
		);
		const report = this.entry.output || this.entry.error || `[${this.entry.status}]`;
		const markdown = new Markdown(report, 0, 0, getMarkdownTheme(), {
			color: (text) => workerForeground(this.entry.workerId, "text", text, this.activeTheme),
		});
		for (const line of markdown.render(contentWidth)) lines.push(wrap(line));
		if (this.entry.mode === "direct") {
			lines.unshift(wrap(""));
			lines.push(wrap(""));
		}
		return lines;
	}

	invalidate(): void {}
}

function renderHandoff(entry: WorkerHandoffEntry, theme: Theme): Component {
	return new WorkerResultCard(entry, theme);
}

export async function recodeWorkers(
	pi: ExtensionAPI,
	directory: WorkerDirectory,
	options: RecodeWorkersOptions = {},
): Promise<void> {
	const chat = new WorkerChatController(directory);
	const settingsPath = options.settingsPath ?? join(getAgentDir(), "recode-workers.json");
	let config = await readWorkerSettingsConfig(settingsPath);
	applyWorkerSettingsConfig(directory, config);
	const updateConfig = async (next: PersistedWorkerSettingsConfig): Promise<void> => {
		config = next;
		applyWorkerSettingsConfig(directory, config);
		await writeWorkerSettingsConfig(settingsPath, config);
	};

	pi.registerEntryRenderer<CreatorMessageEntry>(CREATOR_MESSAGE_ENTRY, (entry, _options, theme) => {
		if (!entry.data) return undefined;
		return new Text(creatorForeground(theme.italic(formatCreatorMessage(entry.data.message)), theme), 0, 0);
	});

	pi.registerEntryRenderer<WorkerHandoffEntry>(WORKER_HANDOFF_ENTRY, (entry, _options, theme) => {
		return entry.data ? renderHandoff(entry.data, theme) : undefined;
	});

	pi.on("session_start", (_event, ctx) => {
		restoreDirectWorkerChats(ctx.sessionManager.getBranch(), chat, directory);
	});

	pi.registerCommand("worker", {
		description: "Open the worker roster, settings, status, and direct chat",
		argumentHint: "[chat|close] <worker> [message]",
		getArgumentCompletions: (prefix) => {
			const options = directory.getWorkerDefinitions().flatMap((worker) => [
				{
					value: `chat ${worker.displayName} `,
					label: `chat ${worker.displayName}`,
					description: `Direct chat with ${identity(worker)}`,
				},
				{
					value: `chat ${worker.aliases?.[0] ?? worker.displayName} `,
					label: `chat ${worker.aliases?.[0] ?? worker.displayName}`,
					description: `Alias for ${identity(worker)}`,
				},
				{
					value: `close ${worker.displayName}`,
					label: `close ${worker.displayName}`,
					description: `Close ${identity(worker)} direct chat`,
				},
			]);
			return options.filter((option) => option.value.startsWith(prefix));
		},
		handler: async (args, ctx) => {
			try {
				const trimmed = args.trim();
				if (!trimmed) {
					await showWorkerPage(pi, chat, directory, ctx, config, updateConfig);
					return;
				}
				const [command, workerReference, ...messageParts] = trimmed.split(/\s+/);
				if (command === "chat" && workerReference) {
					await sendDirectMessage(pi, chat, directory, ctx, workerReference, messageParts.join(" "));
					return;
				}
				if (command === "close" && workerReference) {
					ctx.ui.notify(chat.close(workerReference) ? "Direct chat closed." : "No open direct chat.", "info");
					return;
				}
				ctx.ui.notify("Usage: /worker, /worker chat <name> [message], or /worker close <name>", "warning");
			} catch (error: unknown) {
				ctx.ui.notify(error instanceof Error ? error.message : String(error), "error");
			}
		},
	});

	for (const worker of directory.getWorkerDefinitions()) {
		const commandName = worker.displayName.toLowerCase();
		pi.registerCommand(commandName, {
			description: `Start or continue direct chat with ${identity(worker)}`,
			argumentHint: "<message>",
			getArgumentCompletions: (prefix) =>
				prefix.length === 0
					? [{ value: "", label: "<message>", description: `Type a direct message for ${identity(worker)}` }]
					: null,
			handler: async (args, ctx) => {
				try {
					await sendDirectMessage(pi, chat, directory, ctx, worker.id, args);
				} catch (error: unknown) {
					ctx.ui.notify(error instanceof Error ? error.message : String(error), "error");
				}
			},
		});
	}

	pi.on("session_shutdown", () => chat.clear());
}
