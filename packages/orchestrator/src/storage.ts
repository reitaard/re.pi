import { randomUUID } from "node:crypto";
import {
	closeSync,
	existsSync,
	fsyncSync,
	mkdirSync,
	openSync,
	readFileSync,
	renameSync,
	rmSync,
	writeFileSync,
} from "node:fs";
import { dirname } from "node:path";
import { getInstancesPath, getMachinePath, getOrchestratorDir } from "./config.ts";
import type { InstanceRecord, InstanceStatus, MachineRecord } from "./types.ts";

const MAX_INSTANCES = 1_024;
const DEFAULT_TERMINAL_RETENTION_MS = 60 * 60 * 1_000;
const TERMINAL_STATUSES: ReadonlySet<InstanceStatus> = new Set(["stopped", "succeeded", "failed", "cancelled"]);

export type StorageDiagnosticCode = "BACKUP_INVALID" | "BACKUP_RECOVERED" | "CURRENT_INVALID" | "STATE_UNRECOVERABLE";

export interface StorageDiagnostic {
	code: StorageDiagnosticCode;
	path: string;
	message: string;
	timestamp: string;
}

export interface LoadInstancesOptions {
	now?: Date;
	terminalRetentionMs?: number;
}

export class OrchestratorStorageError extends Error {
	readonly path: string;

	constructor(path: string, message: string) {
		super(message);
		this.name = "OrchestratorStorageError";
		this.path = path;
	}
}

const storageDiagnostics: StorageDiagnostic[] = [];

function recordDiagnostic(code: StorageDiagnosticCode, path: string, error: unknown): void {
	storageDiagnostics.push({
		code,
		path,
		message: error instanceof Error ? error.message : String(error),
		timestamp: new Date().toISOString(),
	});
	if (storageDiagnostics.length > 100) storageDiagnostics.splice(0, storageDiagnostics.length - 100);
}

export function getStorageDiagnostics(): readonly StorageDiagnostic[] {
	return storageDiagnostics.map((diagnostic) => ({ ...diagnostic }));
}

export function clearStorageDiagnostics(): void {
	storageDiagnostics.length = 0;
}

function ensureOrchestratorDir(): void {
	const orchestratorDir = getOrchestratorDir();
	if (!existsSync(orchestratorDir)) mkdirSync(orchestratorDir, { recursive: true });
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function isBoundedString(value: unknown, max: number, optional = false): boolean {
	return (optional && value === undefined) || (typeof value === "string" && value.length > 0 && value.length <= max);
}

function isTimestamp(value: unknown, optional = false): boolean {
	return (optional && value === undefined) || (typeof value === "string" && Number.isFinite(Date.parse(value)));
}

function isMachineRecord(value: unknown): value is MachineRecord {
	return (
		isRecord(value) &&
		isBoundedString(value.id, 512) &&
		isTimestamp(value.createdAt) &&
		isTimestamp(value.lastSeenAt, true) &&
		isBoundedString(value.label, 512, true)
	);
}

const INSTANCE_STATUSES: ReadonlySet<string> = new Set([
	"starting",
	"online",
	"stopping",
	"stopped",
	"error",
	"succeeded",
	"failed",
	"cancelled",
]);

function isInstanceRecord(value: unknown): value is InstanceRecord {
	if (!isRecord(value)) return false;
	if (
		!isBoundedString(value.id, 512) ||
		typeof value.status !== "string" ||
		!INSTANCE_STATUSES.has(value.status) ||
		!isBoundedString(value.cwd, 4096) ||
		!isTimestamp(value.createdAt) ||
		!isTimestamp(value.lastSeenAt, true) ||
		!isTimestamp(value.completedAt, true) ||
		!isBoundedString(value.label, 512, true) ||
		!isBoundedString(value.sessionId, 512, true) ||
		!isBoundedString(value.sessionFile, 4096, true) ||
		!isBoundedString(value.radiusPiId, 512, true) ||
		!isBoundedString(value.terminalDiagnostic, 4096, true)
	) {
		return false;
	}
	if (TERMINAL_STATUSES.has(value.status as InstanceStatus) && value.completedAt === undefined) return false;
	if (value.terminationOutcome !== undefined) {
		if (
			!isRecord(value.terminationOutcome) ||
			typeof value.terminationOutcome.graceful !== "boolean" ||
			typeof value.terminationOutcome.forced !== "boolean" ||
			typeof value.terminationOutcome.exited !== "boolean"
		) {
			return false;
		}
	}
	if (value.processIdentity !== undefined) {
		if (
			!isRecord(value.processIdentity) ||
			!Number.isSafeInteger(value.processIdentity.pid) ||
			(value.processIdentity.pid as number) <= 0 ||
			!isBoundedString(value.processIdentity.startReceipt, 1024)
		) {
			return false;
		}
	}
	return true;
}

function isInstanceArray(value: unknown): value is InstanceRecord[] {
	if (!Array.isArray(value) || value.length > MAX_INSTANCES || !value.every(isInstanceRecord)) return false;
	return new Set(value.map((instance) => instance.id)).size === value.length;
}

function parseValidated<T>(path: string, validate: (value: unknown) => value is T): T {
	const value: unknown = JSON.parse(readFileSync(path, "utf8"));
	if (!validate(value)) throw new OrchestratorStorageError(path, "Persisted state failed schema or bounds validation");
	return value;
}

function backupPath(path: string): string {
	return `${path}.bak`;
}

function loadValidated<T>(path: string, fallback: T, validate: (value: unknown) => value is T): T {
	if (existsSync(path)) {
		try {
			return parseValidated(path, validate);
		} catch (error) {
			recordDiagnostic("CURRENT_INVALID", path, error);
		}
	}
	const backup = backupPath(path);
	if (existsSync(backup)) {
		try {
			const recovered = parseValidated(backup, validate);
			recordDiagnostic("BACKUP_RECOVERED", backup, `Recovered state for ${path}`);
			return recovered;
		} catch (error) {
			recordDiagnostic("BACKUP_INVALID", backup, error);
		}
	}
	if (!existsSync(path)) return fallback;
	const error = new OrchestratorStorageError(path, "Persisted state and backup are unavailable or invalid");
	recordDiagnostic("STATE_UNRECOVERABLE", path, error);
	throw error;
}

function flushDirectory(path: string): void {
	let descriptor: number | undefined;
	try {
		descriptor = openSync(dirname(path), "r");
		fsyncSync(descriptor);
	} catch {
		// Directory fsync is unavailable on some supported Windows filesystems.
	} finally {
		if (descriptor !== undefined) closeSync(descriptor);
	}
}

function atomicWriteText(path: string, text: string): void {
	const temporaryPath = `${path}.${process.pid}.${randomUUID()}.tmp`;
	let descriptor: number | undefined;
	try {
		descriptor = openSync(temporaryPath, "wx", 0o600);
		writeFileSync(descriptor, text, "utf8");
		fsyncSync(descriptor);
		closeSync(descriptor);
		descriptor = undefined;
		renameSync(temporaryPath, path);
		flushDirectory(path);
	} finally {
		if (descriptor !== undefined) closeSync(descriptor);
		if (existsSync(temporaryPath)) rmSync(temporaryPath, { force: true });
	}
}

function saveValidated<T>(path: string, value: T, validate: (candidate: unknown) => candidate is T): void {
	if (!validate(value))
		throw new OrchestratorStorageError(path, "Refusing to persist state that violates schema or bounds");
	ensureOrchestratorDir();
	if (existsSync(path)) {
		try {
			const current = parseValidated(path, validate);
			atomicWriteText(backupPath(path), `${JSON.stringify(current, null, 2)}\n`);
		} catch (error) {
			recordDiagnostic("CURRENT_INVALID", path, error);
		}
	}
	atomicWriteText(path, `${JSON.stringify(value, null, 2)}\n`);
}

export function loadMachine(): MachineRecord | undefined {
	return loadValidated(getMachinePath(), undefined, isMachineRecord);
}

export function saveMachine(machine: MachineRecord): void {
	saveValidated(getMachinePath(), machine, isMachineRecord);
}

export function deleteMachine(): void {
	const machinePath = getMachinePath();
	if (existsSync(machinePath)) rmSync(machinePath);
	const backup = backupPath(machinePath);
	if (existsSync(backup)) rmSync(backup);
}

export function loadInstances(options: LoadInstancesOptions = {}): InstanceRecord[] {
	const terminalRetentionMs = options.terminalRetentionMs ?? DEFAULT_TERMINAL_RETENTION_MS;
	if (!Number.isFinite(terminalRetentionMs) || terminalRetentionMs < 0) {
		throw new OrchestratorStorageError(
			getInstancesPath(),
			"terminalRetentionMs must be a non-negative finite number",
		);
	}
	const cutoff = (options.now ?? new Date()).getTime() - terminalRetentionMs;
	return loadValidated(getInstancesPath(), [], isInstanceArray).filter(
		(instance) =>
			!TERMINAL_STATUSES.has(instance.status) ||
			instance.completedAt === undefined ||
			Date.parse(instance.completedAt) >= cutoff,
	);
}

export function saveInstances(instances: InstanceRecord[]): void {
	saveValidated(getInstancesPath(), instances, isInstanceArray);
}

export function getInstance(instanceId: string): InstanceRecord | undefined {
	return loadInstances().find((instance) => instance.id === instanceId);
}

export function upsertInstance(instance: InstanceRecord): void {
	const instances = loadInstances();
	const index = instances.findIndex((existing) => existing.id === instance.id);
	if (index === -1) instances.push(instance);
	else instances[index] = instance;
	saveInstances(instances);
}
