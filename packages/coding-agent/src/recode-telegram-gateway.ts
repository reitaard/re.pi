import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, resolve } from "node:path";
import type { AgentMessage } from "@reitaard/repi-agent-core";
import { getAgentDir } from "./config.ts";
import type { AgentSessionEvent } from "./core/agent-session.ts";
import { RpcClient, type RpcClientOptions } from "./modes/rpc/rpc-client.ts";

const PREVIEW_LIMIT = 3900;
const EDIT_INTERVAL_MS = 750;

interface TelegramConfig {
	botToken: string;
	allowedUserId: number;
	workingDirectory?: string;
}

interface TelegramState {
	updateOffset: number;
	sessions: Record<string, string>;
}

interface TelegramChat {
	id: number;
}

interface TelegramUser {
	id: number;
}

interface TelegramMessage {
	message_id: number;
	chat: TelegramChat;
	from?: TelegramUser;
	text?: string;
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

interface QueuedTurn {
	chatId: number;
	text: string;
	replyToMessageId: number;
}

function loadTelegramConfig(): TelegramConfig {
	const configPath = resolve(getAgentDir(), "telegram.json");
	const fileConfig = existsSync(configPath)
		? (JSON.parse(readFileSync(configPath, "utf8")) as Partial<TelegramConfig>)
		: {};
	const botToken = process.env.TELEGRAM_BOT_TOKEN ?? fileConfig.botToken;
	const allowedUserIdText = process.env.TELEGRAM_ALLOWED_USER_ID;
	const allowedUserId = allowedUserIdText ? Number(allowedUserIdText) : fileConfig.allowedUserId;
	if (!botToken) throw new Error(`Telegram token missing. Set TELEGRAM_BOT_TOKEN or ${configPath}`);
	if (typeof allowedUserId !== "number" || !Number.isSafeInteger(allowedUserId)) {
		throw new Error(`Telegram user id missing. Set TELEGRAM_ALLOWED_USER_ID or ${configPath}`);
	}
	return {
		botToken,
		allowedUserId,
		workingDirectory: process.env.RECODE_TELEGRAM_CWD ?? fileConfig.workingDirectory,
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

function loadTelegramState(path: string): TelegramState {
	if (!existsSync(path)) return { updateOffset: 0, sessions: {} };
	const state = JSON.parse(readFileSync(path, "utf8")) as Partial<TelegramState>;
	return {
		updateOffset: typeof state.updateOffset === "number" ? state.updateOffset : 0,
		sessions: state.sessions ?? {},
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

	sendMessage(chatId: number, text: string, replyToMessageId?: number): Promise<TelegramMessage> {
		return this.call("sendMessage", {
			chat_id: chatId,
			text,
			...(replyToMessageId ? { reply_parameters: { message_id: replyToMessageId } } : {}),
		});
	}

	editMessage(chatId: number, messageId: number, text: string): Promise<TelegramMessage> {
		return this.call("editMessageText", { chat_id: chatId, message_id: messageId, text });
	}
}

class RecodeTelegramGateway {
	private readonly api: TelegramApi;
	private readonly config: TelegramConfig;
	private readonly abortController = new AbortController();
	private readonly queue: QueuedTurn[] = [];
	private readonly statePath = resolve(getAgentDir(), "telegram-state.json");
	private readonly state = loadTelegramState(this.statePath);
	private rpc: RpcClient | undefined;
	private activeChatId: number | undefined;
	private running = false;
	private previewMessageId: number | undefined;
	private previewText = "";
	private lastEditedText = "";
	private lastEditAt = 0;
	private editTimer: ReturnType<typeof setTimeout> | undefined;
	private previewFlush: Promise<void> = Promise.resolve();

	constructor(config: TelegramConfig) {
		this.config = config;
		this.api = new TelegramApi(config.botToken);
	}

	async run(): Promise<void> {
		let offset = this.state.updateOffset;
		console.log("Recode Telegram gateway started");
		while (!this.abortController.signal.aborted) {
			try {
				const updates = await this.api.getUpdates(offset, this.abortController.signal);
				for (const update of updates) {
					offset = Math.max(offset, update.update_id + 1);
					this.state.updateOffset = offset;
					this.saveState();
					await this.handleUpdate(update);
				}
			} catch (error: unknown) {
				if (this.abortController.signal.aborted) break;
				console.error(error instanceof Error ? error.message : String(error));
				await new Promise((resolveDelay) => setTimeout(resolveDelay, 1500));
			}
		}
		await this.close();
	}

	stop(): void {
		this.abortController.abort();
	}

	private async handleUpdate(update: TelegramUpdate): Promise<void> {
		const message = update.message;
		if (!message?.text || message.from?.id !== this.config.allowedUserId) return;
		const text = message.text.trim();
		if (text === "/start") {
			await this.api.sendMessage(message.chat.id, "Recode is connected. Send a task to Aizen.", message.message_id);
			return;
		}
		if (text === "/status") {
			await this.api.sendMessage(
				message.chat.id,
				this.running
					? `Aizen is running · ${this.queue.length} queued`
					: `Aizen is ready · ${this.queue.length} queued`,
				message.message_id,
			);
			return;
		}
		if (text === "/stop") {
			this.queue.length = 0;
			await this.rpc?.abort();
			await this.api.sendMessage(message.chat.id, "Aizen stopped. The queue was cleared.", message.message_id);
			return;
		}
		if (text === "/new") {
			if (this.running) {
				await this.api.sendMessage(
					message.chat.id,
					"Aizen is busy. Stop the active turn before starting a new session.",
				);
				return;
			}
			await this.rpc?.stop();
			this.rpc = undefined;
			this.activeChatId = undefined;
			this.state.sessions[String(message.chat.id)] = `telegram-${message.chat.id}-${Date.now()}`;
			this.saveState();
			await this.ensureRpc(message.chat.id);
			await this.api.sendMessage(message.chat.id, "New Recode session started.", message.message_id);
			return;
		}
		if (text.startsWith("/")) {
			await this.api.sendMessage(message.chat.id, "Unknown command. Use /start, /new, /status, or /stop.");
			return;
		}

		this.queue.push({ chatId: message.chat.id, text, replyToMessageId: message.message_id });
		if (this.running) {
			await this.api.sendMessage(message.chat.id, `Queued · ${this.queue.length} waiting`, message.message_id);
			return;
		}
		void this.drainQueue();
	}

	private async ensureRpc(chatId: number): Promise<void> {
		if (this.rpc && this.activeChatId === chatId) return;
		await this.rpc?.stop();
		const cwd = resolve(this.config.workingDirectory ?? process.cwd());
		const chatKey = String(chatId);
		const sessionId = this.state.sessions[chatKey] ?? `telegram-${chatId}`;
		this.state.sessions[chatKey] = sessionId;
		this.saveState();
		this.rpc = new RpcClient(rpcProcessOptions(cwd, sessionId));
		this.rpc.onEvent((event) => this.handleAgentEvent(event));
		await this.rpc.start();
		this.activeChatId = chatId;
	}

	private async drainQueue(): Promise<void> {
		if (this.running) return;
		this.running = true;
		try {
			while (this.queue.length > 0) {
				const turn = this.queue.shift();
				if (!turn) break;
				await this.ensureRpc(turn.chatId);
				this.previewText = "";
				this.lastEditedText = "";
				this.previewMessageId = (
					await this.api.sendMessage(turn.chatId, "Aizen is working...", turn.replyToMessageId)
				).message_id;
				await this.rpc?.promptAndWait(turn.text, undefined, 30 * 60 * 1000);
				await this.queuePreviewFlush(true);
			}
		} catch (error: unknown) {
			const message = error instanceof Error ? error.message : String(error);
			if (this.activeChatId) await this.api.sendMessage(this.activeChatId, `Recode failed: ${message}`);
		} finally {
			this.running = false;
		}
	}

	private handleAgentEvent(event: AgentSessionEvent): void {
		if (event.type !== "message_update" && event.type !== "message_end") return;
		const text = extractAssistantText(event.message);
		if (!text) return;
		this.previewText = text;
		void this.queuePreviewFlush(false);
	}

	private queuePreviewFlush(force: boolean): Promise<void> {
		this.previewFlush = this.previewFlush
			.then(() => this.flushPreview(force))
			.catch((error: unknown) => console.error(error instanceof Error ? error.message : String(error)));
		return this.previewFlush;
	}

	private async flushPreview(force: boolean): Promise<void> {
		if (!this.activeChatId || !this.previewMessageId || !this.previewText) return;
		const elapsed = Date.now() - this.lastEditAt;
		if (!force && elapsed < EDIT_INTERVAL_MS) {
			if (!this.editTimer) {
				this.editTimer = setTimeout(() => {
					this.editTimer = undefined;
					void this.queuePreviewFlush(false);
				}, EDIT_INTERVAL_MS - elapsed);
			}
			return;
		}
		if (this.editTimer) clearTimeout(this.editTimer);
		this.editTimer = undefined;
		const chunks = chunkText(this.previewText);
		if (chunks[0] !== this.lastEditedText) {
			await this.api.editMessage(this.activeChatId, this.previewMessageId, chunks[0]);
			this.lastEditedText = chunks[0];
		}
		if (force) {
			for (const chunk of chunks.slice(1)) await this.api.sendMessage(this.activeChatId, chunk);
		}
		this.lastEditAt = Date.now();
	}

	private async close(): Promise<void> {
		if (this.editTimer) clearTimeout(this.editTimer);
		await this.rpc?.stop();
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
	const gateway = new RecodeTelegramGateway(loadTelegramConfig());
	const stop = () => gateway.stop();
	process.once("SIGINT", stop);
	process.once("SIGTERM", stop);
	await gateway.run();
}
