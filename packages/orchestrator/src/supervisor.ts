import { randomUUID } from "node:crypto";
import type {
	AgentSessionEvent,
	AgentSessionEventListener,
	RpcCommand,
	RpcExtensionUIRequest,
	RpcExtensionUIResponse,
	RpcResponse,
} from "@reitaard/repi-coding-agent";
import { radiusPresence } from "./radius.ts";
import { createRpcProcessInstance, type RpcCancellationResult, type RpcDisposeResult } from "./rpc-process.ts";
import { getInstance, loadInstances, saveInstances, upsertInstance } from "./storage.ts";
import type { InstanceRecord, InstanceStatus } from "./types.ts";

export interface SupervisorRpcProcess {
	send(command: RpcCommand): Promise<RpcResponse>;
	handleUiResponse(response: RpcExtensionUIResponse): void;
	onEvent(listener: AgentSessionEventListener): () => void;
	onExit(listener: (error?: Error) => void): () => void;
	setUiRequestHandler(handler: ((request: RpcExtensionUIRequest) => void) | undefined): void;
	cancel?(commandId: string): Promise<RpcCancellationResult>;
	dispose(): Promise<RpcDisposeResult | undefined>;
}

export interface OrchestratorSupervisorOptions {
	createRpcProcess?: (options: { cwd: string }) => SupervisorRpcProcess;
	maxLiveInstances?: number;
	maxSubscribersPerInstance?: number;
	presence?: {
		registerPi(instance: InstanceRecord): Promise<InstanceRecord>;
		disconnectPi(instance: InstanceRecord): Promise<void>;
	};
}

interface LiveInstanceResources {
	rpcProcess?: SupervisorRpcProcess;
	radiusPiId?: string;
	sessionId?: string;
}

interface CleanupOutcome {
	termination?: RpcDisposeResult;
	diagnostic?: string;
}

interface LiveInstance {
	record: InstanceRecord;
	resources: LiveInstanceResources;
	subscribers: Set<AgentSessionEventListener>;
	onUiRequest?: (request: RpcExtensionUIRequest) => void;
	unsubscribeEvents?: () => void;
	unsubscribeExit?: () => void;
}

function cloneInstance(record: InstanceRecord): InstanceRecord {
	return { ...record };
}

// Only refresh persisted session metadata after commands that can plausibly change
// the instance identity/details we store in instances.json. Most RPCs mutate transient
// runtime state only, so forcing a follow-up get_state after every command is wasted IO.
//
// - new_session / switch_session / fork / clone can change sessionId/sessionFile
// - set_session_name changes a persisted session detail we may want reflected externally
// - prompt can materialize or advance persisted session state after the child processes it
const SESSION_METADATA_COMMANDS: ReadonlySet<RpcCommand["type"]> = new Set([
	"new_session",
	"switch_session",
	"fork",
	"clone",
	"set_session_name",
	"prompt",
]);

function shouldRefreshSessionMetadata(command: RpcCommand): boolean {
	return SESSION_METADATA_COMMANDS.has(command.type);
}

function isGetStateSuccess(
	response: RpcResponse,
): response is Extract<
	RpcResponse,
	{ success: true; command: "get_state"; data: { sessionId: string; sessionFile?: string } }
> {
	return response.success === true && response.command === "get_state" && "data" in response;
}

export class OrchestratorSupervisor {
	private readonly liveInstances = new Map<string, LiveInstance>();
	private readonly createRpcProcess: (options: { cwd: string }) => SupervisorRpcProcess;
	private readonly presence: NonNullable<OrchestratorSupervisorOptions["presence"]>;
	private readonly maxLiveInstances: number;
	private readonly maxSubscribersPerInstance: number;

	constructor(options: OrchestratorSupervisorOptions = {}) {
		this.createRpcProcess = options.createRpcProcess ?? createRpcProcessInstance;
		this.presence = options.presence ?? radiusPresence;
		this.maxLiveInstances = options.maxLiveInstances ?? 8;
		this.maxSubscribersPerInstance = options.maxSubscribersPerInstance ?? 16;
		if (!Number.isSafeInteger(this.maxLiveInstances) || this.maxLiveInstances < 1) {
			throw new Error("maxLiveInstances must be a positive safe integer");
		}
		if (!Number.isSafeInteger(this.maxSubscribersPerInstance) || this.maxSubscribersPerInstance < 1) {
			throw new Error("maxSubscribersPerInstance must be a positive safe integer");
		}
	}

	private setStatus(live: LiveInstance, status: InstanceStatus): void {
		live.record = {
			...live.record,
			status,
			lastSeenAt: new Date().toISOString(),
		};
		upsertInstance(live.record);
	}

	private updateRecord(live: LiveInstance, updates: Partial<InstanceRecord>): void {
		live.record = {
			...live.record,
			...updates,
			lastSeenAt: new Date().toISOString(),
		};
		if (updates.radiusPiId !== undefined) {
			live.resources.radiusPiId = updates.radiusPiId;
		}
		if (updates.sessionId !== undefined) {
			live.resources.sessionId = updates.sessionId;
		}
		upsertInstance(live.record);
	}

	private clearBindings(live: LiveInstance): void {
		live.unsubscribeEvents?.();
		live.unsubscribeExit?.();
		live.unsubscribeEvents = undefined;
		live.unsubscribeExit = undefined;
		live.onUiRequest = undefined;
		live.resources.rpcProcess?.setUiRequestHandler(undefined);
	}

	private bindRpcProcess(live: LiveInstance, rpcProcess: SupervisorRpcProcess): void {
		this.clearBindings(live);
		live.resources.rpcProcess = rpcProcess;
		live.unsubscribeEvents = rpcProcess.onEvent((event) => {
			for (const subscriber of live.subscribers) {
				subscriber(event);
			}
		});
		live.unsubscribeExit = rpcProcess.onExit((error) => {
			void this.handleUnexpectedRpcExit(live, error);
		});
		rpcProcess.setUiRequestHandler((request) => {
			live.onUiRequest?.(request);
		});
	}

	private async handleUnexpectedRpcExit(live: LiveInstance, _error?: Error): Promise<void> {
		if (this.liveInstances.get(live.record.id) !== live) {
			return;
		}
		if (live.record.status === "stopping" || live.record.status === "stopped") {
			return;
		}
		this.updateRecord(live, { status: "failed", completedAt: new Date().toISOString() });
		this.clearBindings(live);
		live.resources.rpcProcess = undefined;
		if (live.resources.radiusPiId) {
			try {
				await this.presence.disconnectPi(live.record);
				this.updateRecord(live, { radiusPiId: undefined });
			} catch (error) {
				console.error(`Failed to disconnect Radius Pi ${live.record.id}: ${String(error)}`);
			}
		}
		this.liveInstances.delete(live.record.id);
	}

	private getRpcProcess(live: LiveInstance): SupervisorRpcProcess | undefined {
		return live.resources.rpcProcess;
	}

	private async syncInstanceRecord(live: LiveInstance): Promise<void> {
		const rpcProcess = this.getRpcProcess(live);
		if (!rpcProcess) {
			this.updateRecord(live, {});
			return;
		}
		const response = await rpcProcess.send({ type: "get_state" });
		if (!isGetStateSuccess(response)) {
			this.updateRecord(live, {});
			return;
		}
		this.updateRecord(live, {
			sessionId: response.data.sessionId,
			sessionFile: response.data.sessionFile,
		});
	}

	private async cleanupAcquiredResources(live: LiveInstance): Promise<CleanupOutcome> {
		const rpcProcess = live.resources.rpcProcess;
		const diagnostics: string[] = [];
		let termination: RpcDisposeResult | undefined;
		this.clearBindings(live);
		if (live.resources.radiusPiId) {
			try {
				await this.presence.disconnectPi(live.record);
				live.resources.radiusPiId = undefined;
				live.record = {
					...live.record,
					radiusPiId: undefined,
					lastSeenAt: new Date().toISOString(),
				};
			} catch (error) {
				diagnostics.push(`Presence disconnect failed: ${error instanceof Error ? error.message : String(error)}`);
			}
		}
		live.resources.sessionId = undefined;
		if (rpcProcess) {
			live.resources.rpcProcess = undefined;
			try {
				termination = await rpcProcess.dispose();
			} catch (error) {
				diagnostics.push(`RPC disposal failed: ${error instanceof Error ? error.message : String(error)}`);
			}
		}
		return {
			termination,
			diagnostic: diagnostics.length > 0 ? diagnostics.join("; ").slice(0, 4096) : undefined,
		};
	}

	private async failSpawn(live: LiveInstance, error: unknown): Promise<never> {
		this.setStatus(live, "error");
		try {
			await this.cleanupAcquiredResources(live);
		} finally {
			this.updateRecord(live, { status: "failed", completedAt: new Date().toISOString() });
			this.liveInstances.delete(live.record.id);
		}
		throw error;
	}

	updateInstance(instance: InstanceRecord): void {
		const live = this.liveInstances.get(instance.id);
		if (live) {
			live.record = instance;
			live.resources.radiusPiId = instance.radiusPiId;
			live.resources.sessionId = instance.sessionId;
		}
		upsertInstance(instance);
	}

	openRpcStream(
		instanceId: string,
		onEvent: (event: AgentSessionEvent) => void,
		onUiRequest: (request: RpcExtensionUIRequest) => void,
	):
		| {
				handleRpc(command: RpcCommand): Promise<RpcResponse>;
				handleUiResponse(response: RpcExtensionUIResponse): void;
				close(): void;
		  }
		| undefined {
		const live = this.liveInstances.get(instanceId);
		const rpcProcess = live ? this.getRpcProcess(live) : undefined;
		if (!live || !rpcProcess || live.subscribers.size >= this.maxSubscribersPerInstance) {
			return undefined;
		}
		live.subscribers.add(onEvent);
		live.onUiRequest = onUiRequest;
		return {
			handleRpc: async (command) => {
				const response = await rpcProcess.send(command);
				if (shouldRefreshSessionMetadata(command)) {
					await this.syncInstanceRecord(live);
				}
				return response;
			},
			handleUiResponse: (response) => {
				rpcProcess.handleUiResponse(response);
			},
			close: () => {
				if (live.onUiRequest === onUiRequest) {
					live.onUiRequest = undefined;
				}
				live.subscribers.delete(onEvent);
			},
		};
	}

	getLiveInstance(instanceId: string): InstanceRecord | undefined {
		const live = this.liveInstances.get(instanceId);
		return live ? cloneInstance(live.record) : undefined;
	}

	listLiveInstances(): InstanceRecord[] {
		return [...this.liveInstances.values()].map((live) => cloneInstance(live.record));
	}

	async recoverAfterRestart(): Promise<void> {
		const recoveredAt = new Date().toISOString();
		const instances = loadInstances().map((instance) => {
			const wasLive = instance.status === "online" || instance.status === "starting";
			return {
				...instance,
				status: wasLive ? ("stopped" as const) : instance.status,
				lastSeenAt: recoveredAt,
				completedAt: wasLive ? recoveredAt : instance.completedAt,
			};
		});
		for (const instance of instances) {
			await this.presence.disconnectPi(instance);
		}
		saveInstances(instances);
	}

	listInstances(): InstanceRecord[] {
		return loadInstances().map(cloneInstance);
	}

	getInstance(instanceId: string): InstanceRecord | undefined {
		const live = this.liveInstances.get(instanceId);
		if (live) {
			return cloneInstance(live.record);
		}
		const stored = getInstance(instanceId);
		return stored ? cloneInstance(stored) : undefined;
	}

	async spawnInstance(options: { cwd: string; label?: string }): Promise<InstanceRecord> {
		if (this.liveInstances.size >= this.maxLiveInstances) throw new Error("Maestro live instance limit reached");
		const now = new Date().toISOString();
		const live: LiveInstance = {
			record: {
				id: randomUUID(),
				status: "starting",
				cwd: options.cwd,
				createdAt: now,
				lastSeenAt: now,
				label: options.label,
			},
			resources: {},
			subscribers: new Set(),
		};
		this.liveInstances.set(live.record.id, live);
		upsertInstance(live.record);

		try {
			const rpcProcess = this.createRpcProcess({ cwd: options.cwd });
			this.bindRpcProcess(live, rpcProcess);
			await this.syncInstanceRecord(live);
			const registeredRecord = await this.presence.registerPi(live.record);
			this.updateRecord(live, { radiusPiId: registeredRecord.radiusPiId });
			this.setStatus(live, "online");
			return cloneInstance(live.record);
		} catch (error) {
			return await this.failSpawn(live, error);
		}
	}

	async stopInstance(instanceId: string): Promise<InstanceRecord | undefined> {
		const live = this.liveInstances.get(instanceId);
		if (!live) {
			return undefined;
		}

		this.setStatus(live, "stopping");
		const cleanup = await this.cleanupAcquiredResources(live);
		const completedAt = new Date().toISOString();
		const terminationFailed = cleanup.termination !== undefined && !cleanup.termination.exited;
		live.record = {
			...live.record,
			status: cleanup.diagnostic || terminationFailed ? "failed" : "cancelled",
			lastSeenAt: completedAt,
			completedAt,
			terminationOutcome: cleanup.termination,
			terminalDiagnostic:
				cleanup.diagnostic ?? (terminationFailed ? "RPC process did not exit after forced termination" : undefined),
		};
		this.liveInstances.delete(instanceId);
		upsertInstance(live.record);
		return cloneInstance(live.record);
	}

	async cancelInstance(instanceId: string, commandId?: string): Promise<RpcCancellationResult> {
		if (commandId !== undefined && (!commandId || commandId.length > 512)) {
			throw new Error("commandId must contain 1 to 512 characters");
		}
		const live = this.liveInstances.get(instanceId);
		const rpcProcess = live ? this.getRpcProcess(live) : undefined;
		const cancellationId = commandId ?? `instance:${instanceId}`;
		if (!live || !rpcProcess) {
			return {
				commandId: cancellationId,
				requested: false,
				accepted: false,
				completed: false,
				unsupported: false,
				unknown: true,
			};
		}
		if (commandId) {
			return rpcProcess.cancel
				? await rpcProcess.cancel(commandId)
				: {
						commandId,
						requested: false,
						accepted: false,
						completed: false,
						unsupported: true,
						unknown: false,
					};
		}
		try {
			const response = await rpcProcess.send({ type: "abort" });
			const completed = response.success === true && response.command === "abort";
			return {
				commandId: cancellationId,
				requested: true,
				accepted: completed,
				completed,
				unsupported: false,
				unknown: false,
			};
		} catch {
			return {
				commandId: cancellationId,
				requested: true,
				accepted: false,
				completed: false,
				unsupported: false,
				unknown: false,
			};
		}
	}

	async handleRpc(instanceId: string, command: RpcCommand): Promise<RpcResponse | undefined> {
		const live = this.liveInstances.get(instanceId);
		const rpcProcess = live ? this.getRpcProcess(live) : undefined;
		if (!live || !rpcProcess) {
			return undefined;
		}

		const response = await rpcProcess.send(command);
		if (shouldRefreshSessionMetadata(command)) {
			await this.syncInstanceRecord(live);
		}
		return response;
	}

	async shutdown(): Promise<void> {
		await Promise.all([...this.liveInstances.keys()].map(async (instanceId) => await this.stopInstance(instanceId)));
	}
}

export const supervisor = new OrchestratorSupervisor();

radiusPresence.setCoordinator({
	getLiveInstance(instanceId) {
		return supervisor.getLiveInstance(instanceId);
	},
	listLiveInstances() {
		return supervisor.listLiveInstances();
	},
	updateInstance(instance) {
		supervisor.updateInstance(instance);
	},
});
