import { basename, dirname, join, resolve } from "node:path";
import type { Model } from "@reitaard/repi-ai";
import { getAgentDir } from "../../config.ts";
import type { ModelRegistry } from "../model-registry.ts";
import type { SessionManager } from "../session-manager.ts";
import { RecodeMemoryManager } from "./recode-memory-manager.ts";
import type { RecodeMemoryConfig, RecodeMemoryScope } from "./recode-memory-types.ts";
import {
	executeRecodeShiori,
	executeRecodeShioriFileReview,
	type RecodeShioriMemoryCandidate,
	type RecodeShioriProgressEvent,
} from "./recode-shiori.ts";

interface ManagerEntry {
	manager: RecodeMemoryManager;
	includeProject: boolean;
}

export interface RecodeShioriRuntimeState {
	reviewing: boolean;
	failed: boolean;
}

export function resolveRecodeMemoryLocation(cwd: string): {
	managerKey: string;
	projectMemoryRoot: string;
} {
	const resolvedCwd = resolve(cwd);
	let current = resolvedCwd;
	while (true) {
		if (basename(current) === "memory" && basename(dirname(current)) === ".pi") {
			return {
				managerKey: dirname(dirname(current)),
				projectMemoryRoot: current,
			};
		}
		const parent = dirname(current);
		if (parent === current) break;
		current = parent;
	}
	return {
		managerKey: resolvedCwd,
		projectMemoryRoot: join(resolvedCwd, ".pi", "memory"),
	};
}

/** Process-owned Kioku and Shiori lifecycle, independent of extension/session replacement. */
export class RecodeMemoryRuntime {
	private readonly managers = new Map<string, ManagerEntry>();
	private readonly activeShioriSessions = new Set<string>();
	private readonly shioriListeners = new Set<(state: RecodeShioriRuntimeState) => void>();
	private config?: RecodeMemoryConfig;

	setConfig(config: RecodeMemoryConfig): void {
		this.config = { ...config };
		for (const { manager } of this.managers.values()) manager.setConfig(this.config);
	}

	getConfig(): RecodeMemoryConfig {
		if (!this.config) throw new Error("Recode memory runtime has not been configured");
		return { ...this.config };
	}

	async getManager(cwd: string, includeProject: boolean): Promise<RecodeMemoryManager> {
		if (!this.config) throw new Error("Recode memory runtime has not been configured");
		const { managerKey: key, projectMemoryRoot } = resolveRecodeMemoryLocation(cwd);
		const existing = this.managers.get(key);
		if (existing && (existing.includeProject || !includeProject)) return existing.manager;
		if (existing) existing.manager.close();

		const manager = new RecodeMemoryManager({
			globalRoot: join(getAgentDir(), "memory"),
			projectRoot: projectMemoryRoot,
			databasePath: join(getAgentDir(), "recode-memory.sqlite"),
			config: this.config,
		});
		await manager.initialize(includeProject);
		this.managers.set(key, { manager, includeProject });
		return manager;
	}

	isShioriReviewing(): boolean {
		return this.activeShioriSessions.size > 0;
	}

	subscribeShiori(listener: (state: RecodeShioriRuntimeState) => void): () => void {
		this.shioriListeners.add(listener);
		return () => this.shioriListeners.delete(listener);
	}

	private emitShioriState(failed = false): void {
		const state = { reviewing: this.isShioriReviewing(), failed };
		for (const listener of this.shioriListeners) listener(state);
	}

	async runShiori(options: {
		cwd: string;
		sessionManager: SessionManager;
		modelRegistry: ModelRegistry;
		projectTrusted: boolean;
		model: Model<any>;
		chooseScope?: (
			candidate: RecodeShioriMemoryCandidate,
			globalAccess: boolean,
		) => Promise<RecodeMemoryScope | undefined>;
		onProgress?: (event: RecodeShioriProgressEvent) => void;
		appendMessage?: (message: string) => void;
	}): Promise<Awaited<ReturnType<typeof executeRecodeShiori>> | undefined> {
		const sessionId = options.sessionManager.getSessionId();
		if (this.isShioriReviewing()) return undefined;
		this.activeShioriSessions.add(sessionId);
		try {
			const result = await executeRecodeShiori({
				...options,
				config: this.getConfig(),
				manager: await this.getManager(options.cwd, options.projectTrusted),
				onProgress: (event) => {
					options.onProgress?.(event);
					if (event.type === "start") this.emitShioriState();
				},
			});
			this.activeShioriSessions.delete(sessionId);
			this.emitShioriState();
			return result;
		} catch (error) {
			this.activeShioriSessions.delete(sessionId);
			this.emitShioriState(true);
			throw error;
		}
	}

	async runShioriFileReview(options: {
		cwd: string;
		sessionManager: SessionManager;
		modelRegistry: ModelRegistry;
		projectTrusted: boolean;
		model: Model<any>;
		sourcePath: string;
		content: string;
		chooseScope?: (
			candidate: RecodeShioriMemoryCandidate,
			globalAccess: boolean,
		) => Promise<RecodeMemoryScope | undefined>;
	}): Promise<Awaited<ReturnType<typeof executeRecodeShioriFileReview>> | undefined> {
		const sessionId = options.sessionManager.getSessionId();
		if (this.isShioriReviewing()) return undefined;
		this.activeShioriSessions.add(sessionId);
		this.emitShioriState();
		try {
			const result = await executeRecodeShioriFileReview({
				...options,
				config: this.getConfig(),
				manager: await this.getManager(options.cwd, options.projectTrusted),
			});
			this.activeShioriSessions.delete(sessionId);
			this.emitShioriState();
			return result;
		} catch (error) {
			this.activeShioriSessions.delete(sessionId);
			this.emitShioriState(true);
			throw error;
		}
	}

	close(): void {
		for (const { manager } of this.managers.values()) manager.close();
		this.managers.clear();
		this.shioriListeners.clear();
	}
}
