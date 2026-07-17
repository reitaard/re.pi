import { randomUUID } from "node:crypto";
import type { Model, Models } from "@reitaard/repi-ai";
import type { ModelRegistry } from "../model-registry.ts";
import {
	type NamedWorkerDefinition,
	type NamedWorkerProgressEvent,
	type NamedWorkerRunResult,
	type NamedWorkerRunStatus,
	type NamedWorkerSkill,
	runNamedWorker,
} from "./named-worker.ts";

const DEFAULT_MAX_HISTORY_CHARACTERS = 24_000;
const DEFAULT_MAX_CONVERSATIONS = 64;

export type WorkerConversationStatus = "running" | "closed" | NamedWorkerRunStatus;

export interface WorkerDescriptor {
	id: string;
	displayName: string;
	description: string;
	personality?: string;
	skillName?: string;
	tools: readonly string[];
}

export interface WorkerConversationSnapshot {
	conversationId: string;
	runId?: string;
	workerId: string;
	workerName: string;
	status: WorkerConversationStatus;
	taskSummary: string;
	createdAt: number;
	updatedAt: number;
	elapsedMs: number;
	turnCount: number;
	lastToolName?: string;
	lastOutput?: string;
	error?: string;
}

export interface WorkerConversationTurnResult {
	conversation: WorkerConversationSnapshot;
	result: NamedWorkerRunResult;
}

export interface WorkerDirectoryRuntimeOptions {
	model?: Model<any>;
	getModel?: () => Model<any> | undefined;
	skills?: readonly NamedWorkerSkill[];
	getSkills?: () => readonly NamedWorkerSkill[];
	models?: Models;
	modelRegistry?: ModelRegistry;
	/** Optional host policy. Omit for no worker time limit. */
	timeoutMs?: number;
	maxResultCharacters?: number;
	onProgress?: (event: NamedWorkerProgressEvent) => void;
}

export interface WorkerDirectoryOptions extends WorkerDirectoryRuntimeOptions {
	cwd: string;
	workers: readonly NamedWorkerDefinition[];
	maxHistoryCharacters?: number;
	maxConversations?: number;
}

interface ConversationHistoryEntry {
	role: "caller" | "worker";
	text: string;
}

interface WorkerConversationRecord {
	conversationId: string;
	worker: NamedWorkerDefinition;
	status: WorkerConversationStatus;
	taskSummary: string;
	createdAt: number;
	updatedAt: number;
	startedAt?: number;
	finishedAt?: number;
	turnCount: number;
	runId?: string;
	lastToolName?: string;
	lastOutput?: string;
	error?: string;
	history: ConversationHistoryEntry[];
	abortController?: AbortController;
}

function normalizeWorkerReference(value: string): string {
	return value.trim().toLowerCase();
}

function summarizeTask(value: string): string {
	const compact = value.replace(/\s+/g, " ").trim();
	return compact.length <= 180 ? compact : `${compact.slice(0, 177)}...`;
}

function statusFromResult(result: NamedWorkerRunResult): WorkerConversationStatus {
	return result.status;
}

export class WorkerDirectory {
	private readonly workers: readonly NamedWorkerDefinition[];
	private readonly byReference = new Map<string, NamedWorkerDefinition>();
	private readonly conversations = new Map<string, WorkerConversationRecord>();
	private runtime: WorkerDirectoryRuntimeOptions;
	private readonly cwd: string;
	private readonly maxHistoryCharacters: number;
	private readonly maxConversations: number;

	constructor(options: WorkerDirectoryOptions) {
		if (!options.cwd.trim()) throw new Error("WorkerDirectory cwd is required");
		if (options.workers.length === 0) throw new Error("WorkerDirectory requires at least one worker");
		if (!options.model && !options.getModel) throw new Error("WorkerDirectory requires model or getModel");
		if (!options.models && !options.modelRegistry) {
			throw new Error("WorkerDirectory requires models or modelRegistry");
		}
		this.cwd = options.cwd;
		this.workers = [...options.workers];
		this.runtime = options;
		this.maxHistoryCharacters = options.maxHistoryCharacters ?? DEFAULT_MAX_HISTORY_CHARACTERS;
		this.maxConversations = options.maxConversations ?? DEFAULT_MAX_CONVERSATIONS;
		for (const worker of this.workers) {
			for (const reference of [worker.id, worker.displayName]) {
				const key = normalizeWorkerReference(reference);
				const existing = this.byReference.get(key);
				if (existing && existing.id !== worker.id) {
					throw new Error(`Worker reference collision: ${reference} maps to ${existing.id} and ${worker.id}`);
				}
				this.byReference.set(key, worker);
			}
		}
	}

	updateRuntime(options: WorkerDirectoryRuntimeOptions): void {
		this.runtime = { ...this.runtime, ...options };
	}

	getWorkerDefinitions(): readonly NamedWorkerDefinition[] {
		return this.workers;
	}

	listWorkers(): WorkerDescriptor[] {
		return this.workers.map((worker) => ({
			id: worker.id,
			displayName: worker.displayName,
			description: worker.description,
			personality: worker.personality,
			skillName: worker.skillName,
			tools: worker.tools ?? ["read", "grep", "find", "ls"],
		}));
	}

	resolveWorker(reference: string): NamedWorkerDefinition {
		const worker = this.byReference.get(normalizeWorkerReference(reference));
		if (worker) return worker;
		const available = this.workers.map((candidate) => `${candidate.id} (${candidate.displayName})`).join(", ");
		throw new Error(`Unknown named worker: ${reference}. Available: ${available}`);
	}

	async runOneShot(
		workerReference: string,
		task: string,
		context?: string,
		signal?: AbortSignal,
	): Promise<NamedWorkerRunResult> {
		const worker = this.resolveWorker(workerReference);
		return this.run(worker, task, context, signal, this.runtime.onProgress);
	}

	async startConversation(
		workerReference: string,
		message: string,
		context?: string,
		signal?: AbortSignal,
	): Promise<WorkerConversationTurnResult> {
		this.pruneConversations();
		const worker = this.resolveWorker(workerReference);
		const now = Date.now();
		const record: WorkerConversationRecord = {
			conversationId: randomUUID(),
			worker,
			status: "completed",
			taskSummary: summarizeTask(message),
			createdAt: now,
			updatedAt: now,
			turnCount: 0,
			history: [],
		};
		this.conversations.set(record.conversationId, record);
		const result = await this.executeConversationTurn(record, message, context, signal);
		return { conversation: this.snapshot(record), result };
	}

	async messageConversation(
		conversationId: string,
		message: string,
		context?: string,
		signal?: AbortSignal,
	): Promise<WorkerConversationTurnResult> {
		const record = this.requireConversation(conversationId);
		if (record.status === "closed") throw new Error(`Worker conversation is closed: ${conversationId}`);
		const result = await this.executeConversationTurn(record, message, context, signal);
		return { conversation: this.snapshot(record), result };
	}

	getStatus(conversationId?: string): WorkerConversationSnapshot[] {
		if (conversationId) return [this.snapshot(this.requireConversation(conversationId))];
		return [...this.conversations.values()]
			.sort((left, right) => right.updatedAt - left.updatedAt)
			.map((record) => this.snapshot(record));
	}

	cancelConversation(conversationId: string): boolean {
		const record = this.requireConversation(conversationId);
		if (record.status !== "running" || !record.abortController) return false;
		record.abortController.abort();
		return true;
	}

	closeConversation(conversationId: string): WorkerConversationSnapshot {
		const record = this.requireConversation(conversationId);
		record.abortController?.abort();
		record.status = "closed";
		record.updatedAt = Date.now();
		const snapshot = this.snapshot(record);
		this.conversations.delete(conversationId);
		return snapshot;
	}

	closeAll(): void {
		for (const record of this.conversations.values()) record.abortController?.abort();
		this.conversations.clear();
	}

	private async executeConversationTurn(
		record: WorkerConversationRecord,
		message: string,
		context?: string,
		signal?: AbortSignal,
	): Promise<NamedWorkerRunResult> {
		if (!message.trim()) throw new Error("Worker message is required");
		if (record.status === "running") throw new Error(`Worker conversation is already running: ${record.conversationId}`);

		const controller = new AbortController();
		const onAbort = () => controller.abort();
		signal?.addEventListener("abort", onAbort, { once: true });
		if (signal?.aborted) controller.abort();

		record.abortController = controller;
		record.status = "running";
		record.taskSummary = summarizeTask(message);
		record.startedAt = Date.now();
		record.finishedAt = undefined;
		record.updatedAt = record.startedAt;
		record.lastToolName = undefined;
		record.error = undefined;

		const conversationContext = this.buildConversationContext(record, context);
		try {
			const result = await this.run(record.worker, message, conversationContext, controller.signal, (event) => {
				if (event.type === "start") record.runId = event.runId;
				if (event.type === "tool_start") record.lastToolName = event.toolName;
				record.updatedAt = Date.now();
				this.runtime.onProgress?.(event);
			});
			this.recordResult(record, message, result);
			return result;
		} catch (error: unknown) {
			const errorMessage = error instanceof Error ? error.message : String(error);
			const result: NamedWorkerRunResult = {
				runId: record.runId ?? randomUUID(),
				workerId: record.worker.id,
				workerName: record.worker.displayName,
				status: "failed",
				output: "",
				error: errorMessage,
				durationMs: record.startedAt ? Date.now() - record.startedAt : 0,
				truncated: false,
			};
			this.recordResult(record, message, result);
			return result;
		} finally {
			record.abortController = undefined;
			signal?.removeEventListener("abort", onAbort);
		}
	}

	private recordResult(record: WorkerConversationRecord, message: string, result: NamedWorkerRunResult): void {
		record.runId = result.runId;
		record.status = statusFromResult(result);
		record.finishedAt = Date.now();
		record.updatedAt = record.finishedAt;
		record.turnCount += 1;
		record.lastOutput = result.output || undefined;
		record.error = result.error;
		record.history.push({ role: "caller", text: message.trim() });
		record.history.push({
			role: "worker",
			text: result.output || result.error || `[${result.status}]`,
		});
		this.trimHistory(record);
	}

	private async run(
		worker: NamedWorkerDefinition,
		task: string,
		context: string | undefined,
		signal: AbortSignal | undefined,
		onProgress: ((event: NamedWorkerProgressEvent) => void) | undefined,
	): Promise<NamedWorkerRunResult> {
		const model = this.runtime.getModel?.() ?? this.runtime.model;
		if (!model) throw new Error("Cannot run worker without an active model");
		return runNamedWorker({
			cwd: this.cwd,
			worker,
			model,
			skills: this.runtime.getSkills?.() ?? this.runtime.skills,
			models: this.runtime.models,
			modelRegistry: this.runtime.modelRegistry,
			task,
			context,
			timeoutMs: this.runtime.timeoutMs,
			maxResultCharacters: this.runtime.maxResultCharacters,
			signal,
			onProgress,
		});
	}

	private buildConversationContext(record: WorkerConversationRecord, callerContext?: string): string | undefined {
		const sections: string[] = [];
		if (callerContext?.trim()) sections.push(`CURRENT CALLER CONTEXT\n${callerContext.trim()}`);
		if (record.history.length > 0) {
			const transcript = record.history
				.map((entry) => `${entry.role === "caller" ? "Caller" : record.worker.displayName}: ${entry.text}`)
				.join("\n\n");
			sections.push(`PERSISTENT WORKER CONVERSATION\n${transcript}`);
		}
		return sections.length > 0 ? sections.join("\n\n") : undefined;
	}

	private trimHistory(record: WorkerConversationRecord): void {
		let size = record.history.reduce((sum, entry) => sum + entry.text.length, 0);
		while (size > this.maxHistoryCharacters && record.history.length > 2) {
			const removed = record.history.shift();
			if (removed) size -= removed.text.length;
		}
	}

	private snapshot(record: WorkerConversationRecord): WorkerConversationSnapshot {
		const end = record.finishedAt ?? Date.now();
		return {
			conversationId: record.conversationId,
			runId: record.runId,
			workerId: record.worker.id,
			workerName: record.worker.displayName,
			status: record.status,
			taskSummary: record.taskSummary,
			createdAt: record.createdAt,
			updatedAt: record.updatedAt,
			elapsedMs: record.startedAt ? Math.max(0, end - record.startedAt) : 0,
			turnCount: record.turnCount,
			lastToolName: record.lastToolName,
			lastOutput: record.lastOutput,
			error: record.error,
		};
	}

	private requireConversation(conversationId: string): WorkerConversationRecord {
		const record = this.conversations.get(conversationId);
		if (!record) throw new Error(`Unknown worker conversation: ${conversationId}`);
		return record;
	}

	private pruneConversations(): void {
		if (this.conversations.size < this.maxConversations) return;
		const removable = [...this.conversations.values()]
			.filter((record) => record.status !== "running")
			.sort((left, right) => left.updatedAt - right.updatedAt);
		while (this.conversations.size >= this.maxConversations && removable.length > 0) {
			const record = removable.shift();
			if (record) this.conversations.delete(record.conversationId);
		}
		if (this.conversations.size >= this.maxConversations) {
			throw new Error("Worker conversation limit reached; close an existing conversation first");
		}
	}
}
