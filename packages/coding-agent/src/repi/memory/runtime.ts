import { basename, dirname, join, resolve } from "node:path";
import { getAgentDir } from "../../config.ts";
import { KiokuMemoryManager } from "./manager.ts";
import type { KiokuMemoryConfig } from "./types.ts";

interface ManagerEntry {
	manager: KiokuMemoryManager;
	includeProject: boolean;
}

export function resolveKiokuMemoryLocation(cwd: string): {
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

/** Process-owned Kioku lifecycle, independent of extension/session replacement. */
export class KiokuMemoryRuntime {
	private readonly managers = new Map<string, ManagerEntry>();
	private config?: KiokuMemoryConfig;

	constructor(private readonly agentDir = getAgentDir()) {}

	setConfig(config: KiokuMemoryConfig): void {
		this.config = { ...config };
		for (const { manager } of this.managers.values()) manager.setConfig(this.config);
	}

	getConfig(): KiokuMemoryConfig {
		if (!this.config) throw new Error("Kioku memory runtime has not been configured");
		return { ...this.config };
	}

	async getManager(cwd: string, includeProject: boolean): Promise<KiokuMemoryManager> {
		if (!this.config) throw new Error("Kioku memory runtime has not been configured");
		const { managerKey, projectMemoryRoot } = resolveKiokuMemoryLocation(cwd);
		const existing = this.managers.get(managerKey);
		if (existing && (existing.includeProject || !includeProject)) return existing.manager;
		if (existing) existing.manager.close();

		const manager = new KiokuMemoryManager({
			globalRoot: join(this.agentDir, "memory"),
			projectRoot: projectMemoryRoot,
			databasePath: join(this.agentDir, "recode-memory.sqlite"),
			config: this.config,
		});
		await manager.initialize(includeProject);
		this.managers.set(managerKey, { manager, includeProject });
		return manager;
	}

	close(): void {
		for (const { manager } of this.managers.values()) manager.close();
		this.managers.clear();
	}
}
