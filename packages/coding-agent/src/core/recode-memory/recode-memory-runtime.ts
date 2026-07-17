import { join, resolve } from "node:path";
import type { Model } from "@reitaard/repi-ai";
import { getAgentDir } from "../../config.ts";
import type { ModelRegistry } from "../model-registry.ts";
import type { SessionManager } from "../session-manager.ts";
import { RecodeMemoryManager } from "./recode-memory-manager.ts";
import type { RecodeMemoryConfig, RecodeMemoryScope } from "./recode-memory-types.ts";
import {
	executeRecodeShiori,
	type RecodeShioriMemoryCandidate,
	type RecodeShioriProgressEvent,
} from "./recode-shiori.ts";

interface ManagerEntry {
	manager: RecodeMemoryManager;
	includeProject: boolean;
}

/** Process-owned Kioku and Shiori lifecycle, independent of extension/session replacement. */
export class RecodeMemoryRuntime {
	private readonly managers = new Map<string, ManagerEntry>();
	private readonly activeShioriSessions = new Set<string>();
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
		const key = resolve(cwd);
		const existing = this.managers.get(key);
		if (existing && (existing.includeProject || !includeProject)) return existing.manager;
		if (existing) existing.manager.close();

		const manager = new RecodeMemoryManager({
			globalRoot: join(getAgentDir(), "memory"),
			projectRoot: join(key, ".pi", "memory"),
			databasePath: join(getAgentDir(), "recode-memory.sqlite"),
			config: this.config,
		});
		await manager.initialize(includeProject);
		this.managers.set(key, { manager, includeProject });
		return manager;
	}

	isShioriReviewing(sessionId: string): boolean {
		return this.activeShioriSessions.has(sessionId);
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
	}): Promise<Awaited<ReturnType<typeof executeRecodeShiori>> | undefined> {
		const sessionId = options.sessionManager.getSessionId();
		if (this.activeShioriSessions.has(sessionId)) return undefined;
		this.activeShioriSessions.add(sessionId);
		try {
			return await executeRecodeShiori({
				...options,
				config: this.getConfig(),
				manager: await this.getManager(options.cwd, options.projectTrusted),
			});
		} finally {
			this.activeShioriSessions.delete(sessionId);
		}
	}

	close(): void {
		for (const { manager } of this.managers.values()) manager.close();
		this.managers.clear();
	}
}
