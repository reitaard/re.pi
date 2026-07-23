import type { RpcCommand, RpcResponse } from "@reitaard/repi-coding-agent";
import type {
	ErrorResponse,
	InstanceSummary,
	OrchestratorRequest,
	OrchestratorResponse,
} from "./ipc/protocol.ts";
import { dispatchPhase4ATarget, TargetRoutingError } from "./target-routing.ts";
import type { InstanceRecord } from "./types.ts";

export interface OrchestratorRequestCoordinator {
	spawnInstance(options: { cwd: string; label?: string }): Promise<InstanceRecord>;
	listInstances(): InstanceRecord[];
	getInstance(instanceId: string): InstanceRecord | undefined;
	stopInstance(instanceId: string): Promise<InstanceRecord | undefined>;
	handleRpc(instanceId: string, command: RpcCommand): Promise<RpcResponse | undefined>;
}

function toInstanceSummary(instance: InstanceRecord): InstanceSummary {
	return {
		id: instance.id,
		status: instance.status,
		cwd: instance.cwd,
		label: instance.label,
		sessionId: instance.sessionId,
		sessionFile: instance.sessionFile,
		radiusPiId: instance.radiusPiId,
	};
}

function unknownInstanceError(instanceId: string): ErrorResponse {
	return {
		type: "error",
		ok: false,
		error: `Unknown instance: ${instanceId}`,
	};
}

function targetRoutingError(error: TargetRoutingError): ErrorResponse {
	return {
		type: "error",
		ok: false,
		error: `${error.code}: ${error.message}`,
	};
}

/**
 * Build the orchestrator request router against an injected local coordinator.
 * Target authorization runs before any local coordinator method is called.
 */
export function createOrchestratorRequestHandler(
	coordinator: OrchestratorRequestCoordinator,
): (request: OrchestratorRequest) => Promise<OrchestratorResponse> {
	return async (request) => {
		switch (request.type) {
			case "spawn": {
				const instance = await coordinator.spawnInstance({
					cwd: request.cwd,
					label: request.label,
				});
				return {
					type: "spawn_result",
					ok: true,
					instance: toInstanceSummary(instance),
				};
			}

			case "list": {
				return {
					type: "list_result",
					ok: true,
					instances: coordinator.listInstances().map(toInstanceSummary),
				};
			}

			case "status": {
				const instance = coordinator.getInstance(request.instanceId);
				if (!instance) return unknownInstanceError(request.instanceId);
				return {
					type: "status_result",
					ok: true,
					instance: toInstanceSummary(instance),
				};
			}

			case "stop": {
				const instance = await coordinator.stopInstance(request.instanceId);
				if (!instance) return unknownInstanceError(request.instanceId);
				return {
					type: "stop_result",
					ok: true,
					instanceId: request.instanceId,
				};
			}

			case "rpc": {
				try {
					const response = await dispatchPhase4ATarget(request.target, () =>
						coordinator.handleRpc(request.instanceId, request.command),
					);
					if (!response) return unknownInstanceError(request.instanceId);
					return {
						type: "rpc_result",
						ok: true,
						response,
					};
				} catch (error) {
					if (error instanceof TargetRoutingError) return targetRoutingError(error);
					throw error;
				}
			}

			case "rpc_stream": {
				try {
					const instance = await dispatchPhase4ATarget(request.target, () =>
						coordinator.getInstance(request.instanceId),
					);
					if (!instance) return unknownInstanceError(request.instanceId);
					return {
						type: "rpc_ready",
						ok: true,
						instance: toInstanceSummary(instance),
					};
				} catch (error) {
					if (error instanceof TargetRoutingError) return targetRoutingError(error);
					throw error;
				}
			}
		}
	};
}
