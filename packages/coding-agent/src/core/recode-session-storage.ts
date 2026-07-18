import type { SessionMetadata, SessionStorage, SessionTreeEntry } from "@reitaard/repi-agent-core";
import type { SessionManager } from "./session-manager.ts";

/** Uses the existing RePi JSONL session as AgentRuntime's durable session store. */
export class RecodeSessionStorage implements SessionStorage {
	private readonly manager: SessionManager;

	constructor(manager: SessionManager) {
		this.manager = manager;
	}

	async getMetadata(): Promise<SessionMetadata> {
		return {
			id: this.manager.getSessionId(),
			createdAt: this.manager.getHeader()?.timestamp ?? new Date().toISOString(),
		};
	}

	async getLeafId(): Promise<string | null> {
		return this.manager.getLeafId();
	}

	async setLeafId(leafId: string | null): Promise<void> {
		this.manager.appendEntry({
			type: "leaf",
			id: this.manager.createEntryId(),
			parentId: this.manager.getLeafId(),
			timestamp: new Date().toISOString(),
			targetId: leafId,
		});
	}

	async createEntryId(): Promise<string> {
		return this.manager.createEntryId();
	}

	async appendEntry(entry: SessionTreeEntry): Promise<void> {
		this.manager.appendEntry(entry);
	}

	async getEntry(id: string): Promise<SessionTreeEntry | undefined> {
		return this.manager.getEntry(id);
	}

	async findEntries<TType extends SessionTreeEntry["type"]>(
		type: TType,
	): Promise<Array<Extract<SessionTreeEntry, { type: TType }>>> {
		return this.manager
			.getEntries()
			.filter((entry): entry is Extract<SessionTreeEntry, { type: TType }> => entry.type === type);
	}

	async getLabel(id: string): Promise<string | undefined> {
		return this.manager.getLabel(id);
	}

	async getPathToRoot(leafId: string | null): Promise<SessionTreeEntry[]> {
		return leafId === null ? [] : this.manager.getBranch(leafId);
	}

	async getEntries(): Promise<SessionTreeEntry[]> {
		return this.manager.getEntries();
	}
}
