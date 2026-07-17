import type { AgentTool } from "@reitaard/repi-agent-core";
import type { Model, Models } from "@reitaard/repi-ai";
import { type Static, Type } from "typebox";
import type { ModelRegistry } from "../model-registry.ts";
import {
	type NamedWorkerDefinition,
	type NamedWorkerProgressEvent,
	type NamedWorkerRunResult,
	type NamedWorkerSkill,
	runNamedWorker,
} from "./named-worker.ts";

function createDelegateSchema(workers: readonly NamedWorkerDefinition[]) {
	const workerIds = workers.map((worker) => worker.id);
	const aliases = workers.map((worker) => `${worker.displayName} -> ${worker.id}`).join(", ");
	return Type.Object({
		worker: Type.String({
			description: `Canonical worker id. Allowed values: ${workerIds.join(", ")}. Display-name aliases: ${aliases}.`,
			enum: workerIds,
		}),
		task: Type.String({ description: "One focused task for the worker" }),
		context: Type.Optional(
			Type.String({ description: "Small parent-supplied context that is necessary to complete the task" }),
		),
	});
}

type DelegateSchema = ReturnType<typeof createDelegateSchema>;

export type DelegateToolInput = Static<DelegateSchema>;

export interface DelegateToolDetails {
	result: NamedWorkerRunResult;
}

export interface CreateDelegateToolOptions {
	cwd: string;
	/** Fixed model for tests or simple hosts. */
	model?: Model<any>;
	/** Live model resolver for hosts where the parent can switch models. */
	getModel?: () => Model<any> | undefined;
	workers: readonly NamedWorkerDefinition[];
	skills?: readonly NamedWorkerSkill[];
	getSkills?: () => readonly NamedWorkerSkill[];
	models?: Models;
	modelRegistry?: ModelRegistry;
	timeoutMs?: number;
	maxResultCharacters?: number;
	onProgress?: (event: NamedWorkerProgressEvent) => void;
}

interface ValidatedWorkerRegistry {
	byId: Map<string, NamedWorkerDefinition>;
	byAlias: Map<string, NamedWorkerDefinition>;
}

function normalizeWorkerReference(value: string): string {
	return value.trim().toLowerCase();
}

function buildWorkerDescription(workers: readonly NamedWorkerDefinition[]): string {
	return workers
		.map((worker) => {
			const skill = worker.skillName ? ` [skill: ${worker.skillName}]` : "";
			return `- id=${worker.id}; name=${worker.displayName}${skill}; role=${worker.description}`;
		})
		.join("\n");
}

function validateWorkers(workers: readonly NamedWorkerDefinition[]): ValidatedWorkerRegistry {
	if (workers.length === 0) throw new Error("createDelegateTool requires at least one named worker");
	const byId = new Map<string, NamedWorkerDefinition>();
	const byAlias = new Map<string, NamedWorkerDefinition>();
	for (const worker of workers) {
		if (byId.has(worker.id)) throw new Error(`Duplicate named worker id: ${worker.id}`);
		byId.set(worker.id, worker);
		for (const alias of [worker.id, worker.displayName]) {
			const key = normalizeWorkerReference(alias);
			const existing = byAlias.get(key);
			if (existing && existing.id !== worker.id) {
				throw new Error(`Named worker reference collision: ${alias} maps to both ${existing.id} and ${worker.id}`);
			}
			byAlias.set(key, worker);
		}
	}
	return { byId, byAlias };
}

function formatProcessHeader(result: NamedWorkerRunResult): string {
	const durationSeconds = (result.durationMs / 1_000).toFixed(result.durationMs < 10_000 ? 1 : 0);
	return `[worker ${result.workerId}/${result.workerName} | run ${result.runId.slice(0, 8)} | ${result.status} | ${durationSeconds}s]`;
}

function formatToolResult(result: NamedWorkerRunResult): string {
	const header = formatProcessHeader(result);
	switch (result.status) {
		case "completed":
			return `${header}\n${result.output}`;
		case "cancelled":
			return `${header}\n${result.error ?? "Delegated worker was cancelled."}`;
		case "timeout":
			return `${header}\n${result.error ?? "Delegated worker timed out."}`;
		case "failed":
			return `${header}\n${result.error ?? "Delegated worker failed."}`;
	}
}

/**
 * Create the parent-facing delegate tool.
 *
 * Workers receive only their configured read-only tools. The delegate tool itself
 * is never present in a child harness, which makes delegation depth exactly one.
 */
export function createDelegateTool(options: CreateDelegateToolOptions): AgentTool<
	DelegateSchema,
	DelegateToolDetails
> {
	if (!options.model && !options.getModel) throw new Error("createDelegateTool requires model or getModel");
	const workers = validateWorkers(options.workers);
	const availableWorkers = buildWorkerDescription(options.workers);
	const parameters = createDelegateSchema(options.workers);
	return {
		name: "delegate",
		label: "delegate",
		description: `Delegate one focused, read-only task to a named worker. Delegation depth is limited to one. The worker argument uses the canonical id shown below; display names are accepted as aliases by the runtime. Never invent a worker id or name. When the user explicitly requests a worker by id, display name, or role, that request overrides the simple-task optimization: call delegate even for a single read, grep, find, or ls task. Only skip delegation for simple deterministic work when the user did not request a worker. You may launch multiple independent workers in one turn; the configured model provider may queue their requests. Track each returned worker id, run id, status, and duration before deciding the next action. If delegation fails, report the failure or continue only with exact scoped paths already known; never launch an unbounded repository-wide scan.\n\nWorker directory:\n${availableWorkers}`,
		parameters,
		executionMode: "parallel",
		async execute(_toolCallId, input, signal) {
			const worker = workers.byAlias.get(normalizeWorkerReference(input.worker));
			if (!worker) {
				const available = options.workers.map((candidate) => `${candidate.id} (${candidate.displayName})`).join(", ");
				throw new Error(`Unknown named worker: ${input.worker}. Available: ${available}`);
			}
			const model = options.getModel?.() ?? options.model;
			if (!model) throw new Error("Cannot delegate without an active parent model");
			const result = await runNamedWorker({
				cwd: options.cwd,
				model,
				skills: options.getSkills?.() ?? options.skills,
				models: options.models,
				modelRegistry: options.modelRegistry,
				worker,
				task: input.task,
				context: input.context,
				timeoutMs: options.timeoutMs,
				maxResultCharacters: options.maxResultCharacters,
				signal,
				onProgress: options.onProgress,
			});
			return {
				content: [{ type: "text", text: formatToolResult(result) }],
				details: { result },
			};
		},
	};
}
