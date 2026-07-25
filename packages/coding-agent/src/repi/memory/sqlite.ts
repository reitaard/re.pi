import { createRequire } from "node:module";

export interface KiokuSqliteStatement {
	all(...params: unknown[]): Record<string, unknown>[];
	get(...params: unknown[]): Record<string, unknown> | undefined;
	run(...params: unknown[]): unknown;
}

export interface KiokuSqliteDatabase {
	exec(sql: string): void;
	prepare(sql: string): KiokuSqliteStatement;
	close(): void;
}

interface KiokuSqliteConstructor {
	new (path: string): KiokuSqliteDatabase;
}

interface KiokuSqliteModule {
	Database?: KiokuSqliteConstructor;
	DatabaseSync?: KiokuSqliteConstructor;
}

const require = createRequire(import.meta.url);

export function openKiokuDatabase(path: string): KiokuSqliteDatabase {
	const moduleName = process.versions.bun ? "bun:sqlite" : "node:sqlite";
	const sqlite = require(moduleName) as KiokuSqliteModule;
	const Database = sqlite.DatabaseSync ?? sqlite.Database;
	if (!Database) throw new Error(`SQLite is unavailable from ${moduleName}`);
	return new Database(path);
}
