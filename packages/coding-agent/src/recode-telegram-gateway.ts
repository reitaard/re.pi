import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { basename, resolve } from "node:path";
import type { AgentMessage } from "@reitaard/repi-agent-core";
import { getAgentDir } from "./config.ts";
import type { AgentSessionEvent } from "./core/agent-session.ts";
import {
	RecodeGateway,
	type RecodeGatewayDelivery,
	type RecodeGatewayInboundMessage,
	type RecodeGatewayRuntime,
} from "./core/recode-gateway.ts";
import { RecodeGatewayStore } from "./core/recode-gateway-store.ts";
import { RpcClient, type RpcClientOptions } from "./modes/rpc/rpc-client.ts";

const PREVIEW_LIMIT = 3900;
const EDIT_INTERVAL_MS = 750;

interface TelegramConfig {
	botToken: string;
	allowedUserId: number;
	allowedGroupIds: number[];
	workingDirectory?: string;
}

interface TelegramState {
	updateOffset: number;
	sessions: Record<string, string>;
}

interface TelegramUser {
	id: number;
	username?: string;
}

interface TelegramMessage {
	message_id: number;
	chat: { id: number; type: "private" | "group" | "supergroup" | "channel" };
	from?: TelegramUser;
	text?: string;
	message_thread_id?: number;
	reply_to_message?: TelegramMessage;
}

interface TelegramUpdate {
	update_id: number;
	message?: TelegramMessage;
}

interface TelegramResponse<T> {
	ok: boolean;
	result?: T;
	description?: string;
}

function loadTelegramConfig(): TelegramConfig {
	const configPath = resolve(getAgentDir(), "telegram.json");
	const fileConfig = existsSync(configPath)
		? (JSON.parse(readFileSync(configPath, "utf8")) as Partial<TelegramConfig>)
		: {};
	const botToken = process.env.TELEGRAM_BOT_TOKEN ?? fileConfig.botToken;
	const allowedUserIdText = process.env.TELEGRAM_ALLOWED_USER_ID;
	const allowedUserId = allowedUserIdText ? Number(allowedUserIdText) : fileConfig.allowedUserId;
	const allowedGroupIdsText = process.env.TELEGRAM_ALLOWED_GROUP_IDS;
	const allowedGroupIds = allowedGroupIdsText
		? allowedGroupIdsText.split(",").map((value) => Number(value.trim()))
		: (fileConfig.allowedGroupIds ?? []);
	if (!botToken) throw new Error(`Telegram token missing. Set TELEGRAM_BOT_TOKEN or ${configPath}`);
	if (typeof allowedUserId !== "number" || !Number.isSafeInteger(allowedUserId)) {
		throw new Error(`Telegram user id missing. Set TELEGRAM_ALLOWED_USER_ID or ${configPath}`);
	}
	if (!Array.isArray(allowedGroupIds) || !allowedGroupIds.every(Number.isSafeInteger)) {
		throw new Error(`Telegram group ids must be integers. Set TELEGRAM_ALLOWED_GROUP_IDS or ${configPath}`);
	}
	return {
		botToken,
		allowedUserId,
		allowedGroupIds,
		workingDirectory: process.env.RECODE_TELEGRAM_CWD ?? fileConfig.workingDirectory ?? homedir(),
	};
}

function loadTelegramState(path: string): TelegramState {
	if (!existsSync(path)) return { updateOffset: 0, sessions: {} };
	const state = JSON.parse(readFileSync(path, "utf8")) as Partial<TelegramState>;
	return {
		updateOffset: typeof state.updateOffset === "number" ? state.updateOffset : 0,
		sessions: state.sessions ?? {},
	};
}

function extractAssistantText(message: AgentMessage): string | undefined {
	if (message.role !== "assistant") return undefined;
	return message.content
		.filter((part) => part.type === "text")
		.map((part) => part.text)
		.join("");
}

function rpcProcessOptions(cwd: string, sessionId: string): RpcClientOptions {
	const isNode = basename(process.execPath).toLowerCase().startsWith("node");
	return {
		cwd,
		runtimeExecutable: process.execPath,
		runtimeArgs: isNode ? [process.argv[1]] : [],
		args: ["--aizen", "--session-id", sessionId],
	};
}

class TelegramApi {
	private readonly baseUrl: string;

	constructor(token: string) {
		this.baseUrl = `https://api.telegram.org/bot${token}`;
	}

	async call<T>(method: string, body: Record<string, unknown>, signal?: AbortSignal): Promise<T> {
		const response = await fetch(`${this.baseUrl}/${method}`, {
			method: "POST",
			headers: { "content-type": "application/json" },
			body: JSON.stringify(body),
			signal,
		});
		const result = (await response.json()) as TelegramResponse<T>;
		if (!response.ok || !result.ok || result.result === undefined) {
			throw new Error(result.description ?? `Telegram ${method} failed with HTTP ${response.status}`);
		}
		return result.result;
	}

	getUpdates(offset: number, signal: AbortSignal): Promise<TelegramUpdate[]> {
		return this.call("getUpdates", { offset, timeout: 30, allowed_updates: ["message"] }, signal);
	}

	getMe(): Promise<TelegramUser> {
		return this.call("getMe", {});
	}

	deleteWebhook(): Promise<boolean> {
		return this.call("deleteWebhook", { drop_pending_updates: false });
	}

	sendMessage(chatId: number, text: string, replyToMessageId?: number, threadId?: number): Promise<TelegramMessage> {
		return this.call("sendMessage", {
			chat_id: chatId,
			text,
			...(threadId ? { message_thread_id: threadId } : {}),
			...(replyToMessageId ? { reply_parameters: { message_id: replyToMessageId } } : {}),
		});
	}

	editMessage(chatId: number, messageId: number, text: string): Promise<TelegramMessage> {
		return this.call("editMessageText", { chat_id: chatId, message_id: messageId, text });
	}
}

class TelegramRpcRuntime implements RecodeGatewayRuntime {
	private readonly rpc: RpcClient;
	private onText: ((text: string) => void) | undefined;

	constructor(rpc: RpcClient) {
		this.rpc = rpc;
		this.rpc.onEvent((event) => this.handleAgentEvent(event));
	}

	async start(): Promise<void> {
		await this.rpc.start();
		await this.rpc.waitUntilReady(5 * 60 * 1000);
	}

	async run(prompt: string, onText: (text: string) => void): Promise<void> {
		this.onText = onText;
		try {
			await this.rpc.promptAndWait(prompt, undefined, 30 * 60 * 1000);
		} finally {
			this.onText = undefined;
		}
	}

	abort(): Promise<void> {
		return this.rpc.abort();
	}

	close(): Promise<void> {
		return this.rpc.stop();
	}

	private handleAgentEvent(event: AgentSessionEvent): void {
		if (event.type !== "message_update" && event.type !== "message_end") return;
		const text = extractAssistantText(event.message);
		if (text) this.onText?.(text);
	}
}

class TelegramDelivery implements RecodeGatewayDelivery {
	private readonly api: TelegramApi;
	private readonly chatId: number;
	private readonly replyToMessageId: number;
	private readonly threadId: number | undefined;
	private previewMessageId: number | undefined;
	private previewText = "";
	private lastEditedText = "";
	private lastEditAt = 0;
	private editTimer: ReturnType<typeof setTimeout> | undefined;
	private flushChain: Promise<void> = Promise.resolve();

	constructor(api: TelegramApi, chatId: number, replyToMessageId: number, threadId?: number) {
		this.api = api;
		this.chatId = chatId;
		this.replyToMessageId = replyToMessageId;
		this.threadId = threadId === 1 ? undefined : threadId;
	}

	async begin(): Promise<void> {
		this.previewMessageId = (
			await this.api.sendMessage(this.chatId, "Aizen is working...", this.replyToMessageId, this.threadId)
		).message_id;
	}

	update(text: string): Promise<void> {
		this.previewText = text;
		return this.queueFlush(false);
	}

	complete(text: string): Promise<void> {
		this.previewText = text;
		return this.queueFlush(true);
	}

	async fail(message: string): Promise<void> {
		if (this.editTimer) clearTimeout(this.editTimer);
		await this.api.sendMessage(this.chatId, `Recode failed: ${message}`, this.replyToMessageId, this.threadId);
	}

	private queueFlush(force: boolean): Promise<void> {
		this.flushChain = this.flushChain
			.then(() => this.flush(force))
			.catch((error: unknown) => console.error(error instanceof Error ? error.message : String(error)));
		return this.flushChain;
	}

	private async flush(force: boolean): Promise<void> {
		if (!this.previewMessageId || !this.previewText) return;
		const elapsed = Date.now() - this.lastEditAt;
		if (!force && elapsed < EDIT_INTERVAL_MS) {
			if (!this.editTimer) {
				this.editTimer = setTimeout(() => {
					this.editTimer = undefined;
					void this.queueFlush(false);
				}, EDIT_INTERVAL_MS - elapsed);
			}
			return;
		}
		if (this.editTimer) clearTimeout(this.editTimer);
		this.editTimer = undefined;
		const chunks = chunkText(this.previewText);
		if (chunks[0] !== this.lastEditedText) {
			await this.api.editMessage(this.chatId, this.previewMessageId, chunks[0]);
			this.lastEditedText = chunks[0];
		}
		if (force) {
			for (const chunk of chunks.slice(1)) await this.api.sendMessage(this.chatId, chunk, undefined, this.threadId);
		}
		this.lastEditAt = Date.now();
	}
}

export function telegramConversationId(chatId: number, threadId?: number): string {
	return threadId ? `${chatId}:topic:${threadId}` : String(chatId);
}

export function parseTelegramConversationId(conversationId: string): { chatId: number; threadId?: number } {
	const match = /^(-?\d+)(?::topic:(\d+))?$/.exec(conversationId);
	if (!match) throw new Error(`Invalid Telegram conversation id: ${conversationId}`);
	return { chatId: Number(match[1]), threadId: match[2] ? Number(match[2]) : undefined };
}

export function normalizeTelegramText(text: string, botUsername?: string): string {
	if (!botUsername) return text.trim();
	return text
		.replace(new RegExp(`@${botUsername}\\b`, "gi"), "")
		.replace(/^\/(\w+)@\w+/, "/$1")
		.trim();
}

class RecodeTelegramAdapter {
	private readonly api: TelegramApi;
	private readonly config: TelegramConfig;
	private readonly abortController = new AbortController();
	private readonly statePath = resolve(getAgentDir(), "telegram-state.json");
	private readonly state = loadTelegramState(this.statePath);
	private readonly store = new RecodeGatewayStore(resolve(getAgentDir(), "recode-gateway.sqlite"));
	private readonly gateway: RecodeGateway;
	private bot: TelegramUser | undefined;

	constructor(config: TelegramConfig) {
		this.config = config;
		this.api = new TelegramApi(config.botToken);
		this.store.open();
		this.gateway = new RecodeGateway({
			sessions: {
				getSessionId: (route) =>
					this.store.getSessionId(route) ??
					this.state.sessions[route] ??
					this.state.sessions[route.slice(route.indexOf(":") + 1)],
				setSessionId: (route, sessionId) => {
					this.store.setSessionId(route, sessionId);
					this.state.sessions[route] = sessionId;
					this.saveState();
				},
			},
			jobs: this.store,
			createSessionId: (message) => `telegram-${message.conversationId}-${message.messageId}`,
			createRuntime: async (_route, sessionId) => {
				const cwd = resolve(this.config.workingDirectory ?? process.cwd());
				const runtime = new TelegramRpcRuntime(new RpcClient(rpcProcessOptions(cwd, sessionId)));
				await runtime.start();
				return runtime;
			},
		});
	}

	async run(): Promise<void> {
		try {
			try {
				this.bot = await this.api.getMe();
				await this.api.deleteWebhook();
			} catch (error: unknown) {
				if (!this.bot) throw error;
				console.warn(
					`Telegram webhook cleanup failed; continuing with polling: ${error instanceof Error ? error.message : String(error)}`,
				);
			}
			console.log(`Recode Telegram gateway started${this.bot.username ? ` as @${this.bot.username}` : ""}`);
			const recovered = this.gateway.recover((message) => {
				const route = parseTelegramConversationId(message.conversationId);
				return new TelegramDelivery(this.api, route.chatId, Number(message.messageId), route.threadId);
			});
			if (recovered > 0) console.log(`Recovered ${recovered} accepted Telegram turn${recovered === 1 ? "" : "s"}`);
			let offset = this.state.updateOffset;
			while (!this.abortController.signal.aborted) {
				try {
					const updates = await this.api.getUpdates(offset, this.abortController.signal);
					for (const update of updates) {
						await this.handleUpdate(update);
						offset = Math.max(offset, update.update_id + 1);
						this.state.updateOffset = offset;
						this.saveState();
					}
				} catch (error: unknown) {
					if (this.abortController.signal.aborted) break;
					console.error(error instanceof Error ? error.message : String(error));
					await new Promise((resolveDelay) => setTimeout(resolveDelay, 1500));
				}
			}
		} finally {
			await this.gateway.close();
			this.store.close();
		}
	}

	stop(): void {
		this.abortController.abort();
	}

	private async handleUpdate(update: TelegramUpdate): Promise<void> {
		const message = update.message;
		if (!message?.text || message.from?.id !== this.config.allowedUserId) return;
		if (message.chat.type !== "private") {
			if (message.chat.type !== "group" && message.chat.type !== "supergroup") return;
			if (!this.config.allowedGroupIds.includes(message.chat.id)) return;
			const mentioned = this.bot?.username
				? message.text.toLowerCase().includes(`@${this.bot.username.toLowerCase()}`)
				: false;
			if (!mentioned && message.reply_to_message?.from?.id !== this.bot?.id) return;
		}
		const text = normalizeTelegramText(message.text, this.bot?.username);
		if (!text) return;
		const gatewayMessage = this.toGatewayMessage(message, text);
		if (text === "/start") {
			await this.api.sendMessage(
				message.chat.id,
				"Recode is connected. Send a task to Aizen.",
				message.message_id,
				message.message_thread_id,
			);
			return;
		}
		if (text === "/status") {
			const status = this.gateway.getStatus();
			const jobs = this.store.counts();
			const uptimeMinutes = Math.floor(status.uptimeMs / 60_000);
			await this.api.sendMessage(
				message.chat.id,
				`${status.running ? "Aizen is running" : "Aizen is ready"} · ${status.queued} queued · ${uptimeMinutes}m uptime · ${jobs.accepted} recoverable`,
				message.message_id,
				message.message_thread_id,
			);
			return;
		}
		if (text === "/stop") {
			await this.gateway.abort();
			await this.api.sendMessage(
				message.chat.id,
				"Aizen stopped. The queue was cleared.",
				message.message_id,
				message.message_thread_id,
			);
			return;
		}
		if (text === "/new") {
			if (!(await this.gateway.reset(gatewayMessage))) {
				await this.api.sendMessage(
					message.chat.id,
					"Aizen is busy. Stop the active turn before starting a new session.",
					message.message_id,
					message.message_thread_id,
				);
				return;
			}
			await this.api.sendMessage(
				message.chat.id,
				"New Recode session started.",
				message.message_id,
				message.message_thread_id,
			);
			return;
		}
		if (text.startsWith("/")) {
			await this.api.sendMessage(
				message.chat.id,
				"Unknown command. Use /start, /new, /status, or /stop.",
				message.message_id,
				message.message_thread_id,
			);
			return;
		}

		const status = this.gateway.getStatus();
		const submission = this.gateway.submit(
			gatewayMessage,
			new TelegramDelivery(this.api, message.chat.id, message.message_id, message.message_thread_id),
		);
		if (!submission.accepted) return;
		if (status.running) {
			await this.api.sendMessage(
				message.chat.id,
				`Queued · ${status.queued + 1} waiting`,
				message.message_id,
				message.message_thread_id,
			);
		}
	}

	private toGatewayMessage(message: TelegramMessage, text: string): RecodeGatewayInboundMessage {
		return {
			channel: "telegram",
			conversationId: telegramConversationId(message.chat.id, message.message_thread_id),
			messageId: String(message.message_id),
			text,
		};
	}

	private saveState(): void {
		mkdirSync(getAgentDir(), { recursive: true, mode: 0o700 });
		writeFileSync(this.statePath, `${JSON.stringify(this.state, null, 2)}\n`, { mode: 0o600 });
	}
}

function chunkText(text: string): string[] {
	const chunks: string[] = [];
	let remaining = text.trim() || "Completed without a text response.";
	while (remaining.length > PREVIEW_LIMIT) {
		let boundary = remaining.lastIndexOf("\n", PREVIEW_LIMIT);
		if (boundary < PREVIEW_LIMIT / 2) boundary = remaining.lastIndexOf(" ", PREVIEW_LIMIT);
		if (boundary < PREVIEW_LIMIT / 2) boundary = PREVIEW_LIMIT;
		chunks.push(remaining.slice(0, boundary));
		remaining = remaining.slice(boundary).trimStart();
	}
	chunks.push(remaining);
	return chunks;
}

export async function runRecodeTelegramGateway(): Promise<void> {
	const adapter = new RecodeTelegramAdapter(loadTelegramConfig());
	const stop = () => adapter.stop();
	process.once("SIGINT", stop);
	process.once("SIGTERM", stop);
	await adapter.run();
}
