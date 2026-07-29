export const ORCHESTRATOR_TARGET_KINDS = ["local", "node", "sandbox"] as const;

export type OrchestratorTargetKind = (typeof ORCHESTRATOR_TARGET_KINDS)[number];

export type OrchestratorExecutionTarget = { kind: "local" } | { kind: "node"; nodeId: string } | { kind: "sandbox" };

export interface ResolvedOrchestratorTarget {
	target: OrchestratorExecutionTarget;
	explicit: boolean;
}

export type TargetRoutingErrorCode = "target_invalid" | "target_not_authorized";

export class TargetRoutingError extends Error {
	readonly code: TargetRoutingErrorCode;

	constructor(code: TargetRoutingErrorCode, message: string) {
		super(message);
		this.name = "TargetRoutingError";
		this.code = code;
	}
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function hasExactKeys(value: Record<string, unknown>, expected: readonly string[]): boolean {
	const keys = Object.keys(value).sort();
	const allowed = [...expected].sort();
	return keys.length === allowed.length && keys.every((key, index) => key === allowed[index]);
}

function parseNodeId(value: unknown): string {
	if (
		typeof value !== "string" ||
		value.length === 0 ||
		value.length > 128 ||
		!/^[A-Za-z0-9][A-Za-z0-9._:-]*$/.test(value)
	) {
		throw new TargetRoutingError(
			"target_invalid",
			"Node targets require a bounded nodeId containing only letters, digits, dot, underscore, colon, or dash",
		);
	}
	return value;
}

/**
 * Parse the orchestrator-owned execution target envelope.
 *
 * An omitted target preserves the pre-Phase-4 local route. Exact-key validation
 * prevents scheduler, endpoint, credential, and transport fields from crossing
 * this boundary accidentally.
 */
export function parseOrchestratorTarget(value: unknown): ResolvedOrchestratorTarget {
	if (value === undefined) {
		return { target: { kind: "local" }, explicit: false };
	}
	if (!isRecord(value) || typeof value.kind !== "string") {
		throw new TargetRoutingError("target_invalid", "Execution target must be an object with a valid kind");
	}

	switch (value.kind) {
		case "local": {
			if (!hasExactKeys(value, ["kind"])) {
				throw new TargetRoutingError("target_invalid", "Local target accepts only the kind field");
			}
			return { target: { kind: "local" }, explicit: true };
		}
		case "node": {
			if (!hasExactKeys(value, ["kind", "nodeId"])) {
				throw new TargetRoutingError("target_invalid", "Node target requires exactly kind and nodeId");
			}
			return {
				target: { kind: "node", nodeId: parseNodeId(value.nodeId) },
				explicit: true,
			};
		}
		case "sandbox": {
			if (!hasExactKeys(value, ["kind"])) {
				throw new TargetRoutingError("target_invalid", "Sandbox target accepts only the kind field");
			}
			return { target: { kind: "sandbox" }, explicit: true };
		}
		default:
			throw new TargetRoutingError("target_invalid", "Execution target kind is unsupported");
	}
}

/**
 * Phase 4A authorizes only the existing local execution path. Node and sandbox
 * envelopes are parsed now so later phases can add policy and transport without
 * changing the inner browser action contract.
 */
export function resolvePhase4ATarget(value: unknown): ResolvedOrchestratorTarget {
	const resolved = parseOrchestratorTarget(value);
	if (resolved.target.kind !== "local") {
		throw new TargetRoutingError(
			"target_not_authorized",
			`${resolved.target.kind} execution is not authorized in Phase 4A`,
		);
	}
	return resolved;
}

/**
 * Dispatch through the unchanged local route. The local callback receives no
 * target argument by design, so orchestration-only fields cannot enter the
 * coding-agent RPC command or registered browser tool input.
 */
export async function dispatchPhase4ATarget<T>(value: unknown, executeLocal: () => T | Promise<T>): Promise<T> {
	resolvePhase4ATarget(value);
	return await executeLocal();
}
