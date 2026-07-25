import { mkdir } from "node:fs/promises";
import { dirname, resolve, sep } from "node:path";
import { openKiokuDatabase, type KiokuSqliteDatabase } from "./sqlite.ts";
import type {
	KiokuMemoryChunk,
	KiokuMemoryDocument,
	KiokuMemoryScopeSelection,
	KiokuMemorySearchResult,
} from "./types.ts";

function numberValue(value: unknown): number {
	return typeof value === "number" ? value : Number(value ?? 0);
}

function stringValue(value: unknown): string {
	return typeof value === "string" ? value : String(value ?? "");
}

function normalizeFsPath(path: string): string {
	const normalized = resolve(path);
	return process.platform === "win32" ? normalized.toLowerCase() : normalized;
}

function ftsQuery(query: string): string {
	const terms = query.toLowerCase().match(/[\p{L}\p{N}_-]{2,}/gu) ?? [];
	return [...new Set(terms)]
		.slice(0, 16)
		.map((term) => `"${term.replaceAll('"', '""')}"`)
		.join(" OR ");
}

function projectPrefix(projectRoot: string): string {
	return `${resolve(projectRoot)}${sep}`;
}

export class KiokuMemoryStore {
	readonly databasePath: string;
	private database?: KiokuSqliteDatabase;

	constructor(databasePath: string) {
		this.databasePath = databasePath;
	}

	async open(): Promise<void> {
		if (this.database) return;
		await mkdir(dirname(this.databasePath), { recursive: true });
		const database = openKiokuDatabase(this.databasePath);
		database.exec(`
			PRAGMA foreign_keys = ON;
			PRAGMA journal_mode = WAL;
			PRAGMA synchronous = NORMAL;
			PRAGMA busy_timeout = 5000;
			PRAGMA temp_store = MEMORY;
			PRAGMA wal_autocheckpoint = 256;
			CREATE TABLE IF NOT EXISTS recode_memory_documents (
				id TEXT PRIMARY KEY,
				scope TEXT NOT NULL,
				path TEXT NOT NULL UNIQUE,
				hash TEXT NOT NULL,
				mtime_ms REAL NOT NULL,
				updated_at INTEGER NOT NULL
			);
			CREATE TABLE IF NOT EXISTS recode_memory_chunks (
				id TEXT PRIMARY KEY,
				document_id TEXT NOT NULL REFERENCES recode_memory_documents(id) ON DELETE CASCADE,
				scope TEXT NOT NULL,
				path TEXT NOT NULL,
				line_start INTEGER NOT NULL,
				line_end INTEGER NOT NULL,
				text TEXT NOT NULL,
				token_count INTEGER NOT NULL,
				updated_at INTEGER NOT NULL
			);
			CREATE VIRTUAL TABLE IF NOT EXISTS recode_memory_fts USING fts5(
				id UNINDEXED,
				path,
				text,
				tokenize = 'unicode61 remove_diacritics 2'
			);
			CREATE INDEX IF NOT EXISTS recode_memory_chunks_document ON recode_memory_chunks(document_id);
			CREATE INDEX IF NOT EXISTS recode_memory_chunks_scope ON recode_memory_chunks(scope);
		`);
		this.database = database;
	}

	close(): void {
		if (!this.database) return;
		try {
			this.database.exec("PRAGMA wal_checkpoint(PASSIVE); PRAGMA optimize;");
		} finally {
			this.database.close();
			this.database = undefined;
		}
	}

	private db(): KiokuSqliteDatabase {
		if (!this.database) throw new Error("Kioku memory database is not open");
		return this.database;
	}

	getDocument(path: string): KiokuMemoryDocument | undefined {
		const row = this.db()
			.prepare("SELECT id, scope, path, hash, mtime_ms FROM recode_memory_documents WHERE path = ?")
			.get(path);
		if (!row) return undefined;
		return {
			id: stringValue(row.id),
			scope: stringValue(row.scope) === "project" ? "project" : "global",
			path: stringValue(row.path),
			hash: stringValue(row.hash),
			mtimeMs: numberValue(row.mtime_ms),
		};
	}

	replaceDocument(document: KiokuMemoryDocument, chunks: KiokuMemoryChunk[]): void {
		const database = this.db();
		const now = Date.now();
		database.exec("BEGIN IMMEDIATE");
		try {
			const oldChunks = database.prepare("SELECT id FROM recode_memory_chunks WHERE document_id = ?").all(document.id);
			const deleteFts = database.prepare("DELETE FROM recode_memory_fts WHERE id = ?");
			for (const row of oldChunks) deleteFts.run(stringValue(row.id));
			database.prepare("DELETE FROM recode_memory_chunks WHERE document_id = ?").run(document.id);
			database
				.prepare(`
					INSERT INTO recode_memory_documents (id, scope, path, hash, mtime_ms, updated_at)
					VALUES (?, ?, ?, ?, ?, ?)
					ON CONFLICT(path) DO UPDATE SET
						id = excluded.id,
						scope = excluded.scope,
						hash = excluded.hash,
						mtime_ms = excluded.mtime_ms,
						updated_at = excluded.updated_at
				`)
				.run(document.id, document.scope, document.path, document.hash, document.mtimeMs, now);

			const insertChunk = database.prepare(`
				INSERT INTO recode_memory_chunks
				(id, document_id, scope, path, line_start, line_end, text, token_count, updated_at)
				VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
			`);
			const insertFts = database.prepare("INSERT INTO recode_memory_fts (id, path, text) VALUES (?, ?, ?)");
			for (const chunk of chunks) {
				insertChunk.run(
					chunk.id,
					chunk.documentId,
					chunk.scope,
					chunk.path,
					chunk.lineStart,
					chunk.lineEnd,
					chunk.text,
					chunk.tokenCount,
					now,
				);
				insertFts.run(chunk.id, chunk.path, chunk.text);
			}
			database.exec("COMMIT");
		} catch (error) {
			database.exec("ROLLBACK");
			throw error;
		}
	}

	removeMissing(paths: Set<string>, managedRoots: string[]): void {
		const database = this.db();
		const existing = new Set([...paths].map(normalizeFsPath));
		const roots = managedRoots.map(normalizeFsPath);
		const rows = database.prepare("SELECT id, path FROM recode_memory_documents").all();
		for (const row of rows) {
			const path = stringValue(row.path);
			const normalizedPath = normalizeFsPath(path);
			const managed = roots.some((root) => normalizedPath === root || normalizedPath.startsWith(`${root}${sep}`));
			if (!managed || existing.has(normalizedPath)) continue;

			const documentId = stringValue(row.id);
			const chunks = database.prepare("SELECT id FROM recode_memory_chunks WHERE document_id = ?").all(documentId);
			database.exec("BEGIN IMMEDIATE");
			try {
				const deleteFts = database.prepare("DELETE FROM recode_memory_fts WHERE id = ?");
				for (const chunk of chunks) deleteFts.run(stringValue(chunk.id));
				database.prepare("DELETE FROM recode_memory_chunks WHERE document_id = ?").run(documentId);
				database.prepare("DELETE FROM recode_memory_documents WHERE id = ?").run(documentId);
				database.exec("COMMIT");
			} catch (error) {
				database.exec("ROLLBACK");
				throw error;
			}
		}
	}

	search(
		query: string,
		scope: KiokuMemoryScopeSelection,
		limit: number,
		projectRoot: string,
	): KiokuMemorySearchResult[] {
		const match = ftsQuery(query);
		if (!match) return [];

		const root = resolve(projectRoot);
		const prefix = projectPrefix(root);
		let scopeSql = "AND c.scope = 'global'";
		const params: unknown[] = [match];
		if (scope === "project") {
			scopeSql = "AND c.scope = 'project' AND (c.path = ? OR substr(c.path, 1, length(?)) = ?)";
			params.push(root, prefix, prefix);
		} else if (scope === "both") {
			scopeSql = "AND (c.scope = 'global' OR (c.scope = 'project' AND (c.path = ? OR substr(c.path, 1, length(?)) = ?)))";
			params.push(root, prefix, prefix);
		}
		params.push(limit);

		const rows = this.db()
			.prepare(`
				SELECT c.*, bm25(recode_memory_fts, 0.0, 0.25, 1.0) AS rank
				FROM recode_memory_fts
				JOIN recode_memory_chunks c ON c.id = recode_memory_fts.id
				WHERE recode_memory_fts MATCH ? ${scopeSql}
				ORDER BY rank ASC
				LIMIT ?
			`)
			.all(...params);

		return rows.map((row) => {
			const rank = numberValue(row.rank);
			return {
				id: stringValue(row.id),
				documentId: stringValue(row.document_id),
				scope: stringValue(row.scope) === "project" ? "project" : "global",
				path: stringValue(row.path),
				lineStart: numberValue(row.line_start),
				lineEnd: numberValue(row.line_end),
				text: stringValue(row.text),
				tokenCount: numberValue(row.token_count),
				updatedAt: numberValue(row.updated_at),
				score: 1 / (1 + Math.exp(rank)),
			};
		});
	}

	counts(projectRoot: string): { documents: number; chunks: number } {
		const root = resolve(projectRoot);
		const prefix = projectPrefix(root);
		const where = "scope = 'global' OR (scope = 'project' AND (path = ? OR substr(path, 1, length(?)) = ?))";
		const documents = this.db()
			.prepare(`SELECT COUNT(*) AS count FROM recode_memory_documents WHERE ${where}`)
			.get(root, prefix, prefix);
		const chunks = this.db()
			.prepare(`SELECT COUNT(*) AS count FROM recode_memory_chunks WHERE ${where}`)
			.get(root, prefix, prefix);
		return { documents: numberValue(documents?.count), chunks: numberValue(chunks?.count) };
	}
}
