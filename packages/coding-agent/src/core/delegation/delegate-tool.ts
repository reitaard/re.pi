import type { AgentTool } from "@reitaard/repi-agent-core";
import type { Model, Models } from "@reitaard/repi-ai";
import { type Static, Type } from "typebox";
import type { ModelRegistry } from "../model-registry.ts";
import {
	type NamedWorkerDefinition,
	type NamedWorkerProgressEvent,
	type NamedWorkerRunResult,
	runNamedWorker,
} from "./named-worker.ts";

const delegateSchema = Type.Object({
	worker: Type.String({ description: "Stable id of the named worker to run" }),
	task: Type.String({ description: "One focused task for the worker" }),
	context: Type.Optional(
		Type.String({ description: "Small parent-supplied context that is necessary to complete the task" }),
	),
});

export type DelegateToolInput = Static<typeof delegateSchema>;

export interface DelegateToolDetails {
	result: NamedWorkerRunResult;
}

export interface CreateDelegateToolOptions {
	cwd: string;
	model: Model<any>;
	workers: readonly NamedWorkerDefinition[];
	models?: Models;
	modelRegistry?: ModelRegistry;
	timeoutMs?: number;
	maxResultCharacters?: number;
	onProgress?: (event: NamedWorkerProgressEvent) => void;
}

function buildWorkerDescription(workers: readonly NamedWorkerDefinition[]): string {
	return workers.map((worker) => `- ${worker.id}: ${worker.displayName} — ${worker.description}`).join("\n");
}

function validateWorkers(workers: readonly NamedWorkerDefinition[]): Map<string, NamedWorkerDefinition> {
	if (workers.length === 0) throw new Error("createDelegateTool requires at least one named worker");
	const registry = new Map<string, NamedWorkerDefinition>();
	for (const worker of workers) {
		if (registry.has(worker.id)) throw new Error(`Duplicate named worker id: ${worker.id}`);
		registry.set(worker.id, worker);
	}
	return registry;
}

function formatToolResult(result: NamedWorkerRunResult): string {
	switch (result.status) {
		case "completed":
			return `${result.workerName} completed the delegated task.\n\n${result.output}`;
		case "cancelled":
			return `${result.workerName} was cancelled${result.error ? `: ${result.error}` : "."}`;
		case "timeout":
			return `${result.workerName} timed out${result.error ? `: ${result.error}` : "."}`;
		case "failed":
			return `${result.workerName} failed${result.error ? `: ${result.error}` : "."}`;
	}
}

/**
 * Create the parent-facing delegate tool for the non-production delegation spike.
 *
 * Workers receive only their configured read-only tools. The delegate tool itself
 * is never present in a child harness, which makes delegation depth exactly one.
 */
export function createDelegateTool(options: CreateDelegateToolOptions): AgentTool<
	typeof delegateSchema,
	DelegateToolDetails
> {
	const workers = validateWorkers(options.workers);
	const availableWorkers = buildWorkerDescription(options.workers);
	return {
		name: "delegate",
		label: "delegate",
		description: `Delegate one focused, read-only task to a named worker. Delegation depth is limited to one.\n\nAvailable workers:\n${availableWorkers}`,
		parameters: delegateSchema,
		executionMode: "sequential",
		async execute(_toolCallId, input, signal) {
			const worker = workers.get(input.worker);
			if (!worker) {
				throw new Error(`Unknown named worker: ${input.worker}. Available: ${[...workers.keys()].join(", ")}`);
			}
			const result = await runNamedWorker({
				cwd: options.cwd,
				model: options.model,
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
