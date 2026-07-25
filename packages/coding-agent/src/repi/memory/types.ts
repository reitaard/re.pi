export type KiokuMemoryScope = "global" | "project";
export type KiokuMemoryScopeSelection = KiokuMemoryScope | "both";

export interface KiokuMemoryConfig {
	enabled: boolean;
	scope: KiokuMemoryScopeSelection;
	/** Automatic recall from the active project. */
	autoRecall: boolean;
	/** Permit explicit reads, writes, and searches against global memory. */
	globalAccess: boolean;
	/** Include global memory in automatic recall. Requires globalAccess. */
	globalAutoRecall: boolean;
	maxResults: number;
	maxInjectedCharacters: number;
}

export interface KiokuMemoryDocument {
	id: string;
	scope: KiokuMemoryScope;
	path: string;
	hash: string;
	mtimeMs: number;
}

export interface KiokuMemoryChunk {
	id: string;
	documentId: string;
	scope: KiokuMemoryScope;
	path: string;
	lineStart: number;
	lineEnd: number;
	text: string;
	tokenCount: number;
}

export interface KiokuMemorySearchResult extends KiokuMemoryChunk {
	score: number;
	updatedAt: number;
}

export interface KiokuMemoryStatus {
	enabled: boolean;
	scope: KiokuMemoryScopeSelection;
	documents: number;
	chunks: number;
	databasePath: string;
	globalRoot: string;
	projectRoot: string;
}
