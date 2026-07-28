export type InstanceStatus =
	| "starting"
	| "online"
	| "stopping"
	| "stopped"
	| "error"
	| "succeeded"
	| "failed"
	| "cancelled";

export interface MachineRecord {
	id: string;
	createdAt: string;
	lastSeenAt?: string;
	label?: string;
}

export interface RadiusRegistration {
	heartbeatIntervalMs: number;
	expiresInMs: number;
}

export interface ProcessIdentityRecord {
	pid: number;
	startReceipt: string;
}

export interface TerminationOutcome {
	graceful: boolean;
	forced: boolean;
	exited: boolean;
}

export interface InstanceRecord {
	id: string;
	status: InstanceStatus;
	cwd: string;
	createdAt: string;
	lastSeenAt?: string;
	completedAt?: string;
	label?: string;
	sessionId?: string;
	sessionFile?: string;
	radiusPiId?: string;
	processIdentity?: ProcessIdentityRecord;
	terminationOutcome?: TerminationOutcome;
	terminalDiagnostic?: string;
}
