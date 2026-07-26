import { createHash } from "node:crypto";
import { type Dirent, type FSWatcher, watch } from "node:fs";
import { appendFile, mkdir, readdir, readFile, realpath, stat, writeFile } from "node:fs/promises";
import { basename, dirname, isAbsolute, join, relative, resolve } from "node:path";
import { chunkKiokuMemory, kiokuDocumentId } from "./chunker.ts";
import { KiokuMemoryStore } from "./store.ts";
import type {
	KiokuMemoryConfig,
	KiokuMemoryScope,
	KiokuMemorySearchResult,
	KiokuMemoryStatus,
} from "./types.ts";

interface MemoryFile {
	scope: KiokuMemoryScope;
	path: string;
}

const SENSITIVE_PATTERNS = [
	/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/i,
	/\b(?:api[_-]?key|access[_-]?token|client[_-]?secret|password)\s*[:=]\s*\S{8,}/i,
	/\b(?:sk|ghp|github_pat)_[A-Za-z0-9_-]{16,}\b/,
];

function isWithin(root: string, candidate: string): boolean {
	const rel = relative(root, candidate);
	return rel === "" || (!rel.startsWith("..") && !isAbsolute(rel));
}

async function markdownFiles(root: string, scope: KiokuMemoryScope): Promise<MemoryFile[]> {
	const found: MemoryFile[] = [];
	async function walk(directory: string): Promise<void> {
		let entries: Dirent[];
		try {
			entries = await readdir(directory, { withFileTypes: true });
		} catch {
			return;
		}
		for (const entry of entries) {
			const path = join(directory, entry.name);
			if (entry.isDirectory() && entry.name !== "desk" && entry.name !== "archive") {
				await walk(path);
			} else if (entry.isFile() && entry.name.toLowerCase().endsWith(".md")) {
				found.push({ scope, path });
			}
		}
	}
	await walk(root);
	return found;
}

function normalizedTags(tags: string[]): string[] {
	return [
		...new Set(
			tags
				.map((tag) =>
					tag
						.trim()
						.toLowerCase()
						.replace(/[^a-z0-9_-]+/g, "-"),
				)
				.filter(Boolean),
		),
	];
}

export class KiokuMemoryManager {
	readonly globalRoot: string;
	readonly projectRoot: string;
	readonly store: KiokuMemoryStore;
	private config: KiokuMemoryConfig;
	private watchers: FSWatcher[] = [];
	private reconciliationTimer?: NodeJS.Timeout;
	private reconciliationDebounce?: NodeJS.Timeout;
	private syncQueue: Promise<void> = Promise.resolve();
	private includeProject = true;

	constructor(options: {
		globalRoot: string;
		projectRoot: string;
		databasePath: string;
		config: KiokuMemoryConfig;
	}) {
		this.globalRoot = resolve(options.globalRoot);
		this.projectRoot = resolve(options.projectRoot);
		this.store = new KiokuMemoryStore(options.databasePath);
		this.config = { ...options.config };
	}

	async initialize(includeProject = true): Promise<void> {
		this.includeProject = includeProject;
		await Promise.all([
			mkdir(this.globalRoot, { recursive: true }),
			...(includeProject ? [mkdir(this.projectRoot, { recursive: true })] : []),
			this.store.open(),
		]);
		await this.sync(includeProject);
		this.startWatching();
	}

	close(): void {
		for (const watcher of this.watchers) watcher.close();
		this.watchers = [];
		if (this.reconciliationDebounce) clearTimeout(this.reconciliationDebounce);
		if (this.reconciliationTimer) clearInterval(this.reconciliationTimer);
		this.reconciliationDebounce = undefined;
		this.reconciliationTimer = undefined;
		this.store.close();
	}

	getConfig(): KiokuMemoryConfig {
		return { ...this.config };
	}

	setConfig(config: KiokuMemoryConfig): void {
		this.config = { ...config };
	}

	async sync(includeProject = this.includeProject): Promise<{ indexed: number; unchanged: number }> {
		let result = { indexed: 0, unchanged: 0 };
		const operation = this.syncQueue.then(async () => {
			result = await this.performSync(includeProject);
		});
		this.syncQueue = operation.catch(() => {});
		await operation;
		return result;
	}

	private async performSync(includeProject: boolean): Promise<{ indexed: number; unchanged: number }> {
		const files = [
			...(await markdownFiles(this.globalRoot, "global")),
			...(includeProject ? await markdownFiles(this.projectRoot, "project") : []),
		];
		const existing = new Set(files.map((file) => resolve(file.path)));
		let indexed = 0;
		let unchanged = 0;

		for (const file of files) {
			const path = resolve(file.path);
			const [content, info] = await Promise.all([readFile(path, "utf8"), stat(path)]);
			const hash = createHash("sha256").update(content).digest("hex");
			const previous = this.store.getDocument(path);
			if (previous?.hash === hash && previous.mtimeMs === info.mtimeMs) {
				unchanged += 1;
				continue;
			}
			const id = kiokuDocumentId(file.scope, path);
			this.store.replaceDocument(
				{ id, scope: file.scope, path, hash, mtimeMs: info.mtimeMs },
				chunkKiokuMemory(id, file.scope, path, content),
			);
			indexed += 1;
		}

		this.store.removeMissing(existing, includeProject ? [this.globalRoot, this.projectRoot] : [this.globalRoot]);
		return { indexed, unchanged };
	}

	private startWatching(): void {
		for (const watcher of this.watchers) watcher.close();
		this.watchers = [];
		if (this.reconciliationTimer) clearInterval(this.reconciliationTimer);
		const roots = [this.globalRoot, ...(this.includeProject ? [this.projectRoot] : [])];
		for (const root of roots) {
			try {
				const watcher = watch(root, { recursive: true }, (_eventType, filename) => {
					if (filename && !filename.toLowerCase().endsWith(".md")) return;
					this.scheduleReconciliation();
				});
				watcher.on("error", () => this.scheduleReconciliation());
				this.watchers.push(watcher);
			} catch {
				// Periodic reconciliation remains available where recursive watch is unsupported.
			}
		}
		this.reconciliationTimer = setInterval(() => this.scheduleReconciliation(), 60_000);
		this.reconciliationTimer.unref();
	}

	private scheduleReconciliation(): void {
		if (this.reconciliationDebounce) clearTimeout(this.reconciliationDebounce);
		this.reconciliationDebounce = setTimeout(() => {
			this.reconciliationDebounce = undefined;
			void this.sync().catch(() => {});
		}, 250);
		this.reconciliationDebounce.unref();
	}

	async search(
		query: string,
		limit = this.config.maxResults,
		scope = this.config.scope,
	): Promise<KiokuMemorySearchResult[]> {
		if (!this.config.enabled) return [];
		return this.store.search(query, scope, Math.floor(Math.max(1, Math.min(limit, 20))), this.projectRoot);
	}

	async write(
		scope: KiokuMemoryScope,
		text: string,
		daily = false,
		tags: string[] = [],
	): Promise<string> {
		if (scope === "project" && !this.includeProject) {
			throw new Error("Project memory is unavailable until this project is trusted");
		}
		const cleaned = text.trim();
		if (!cleaned) throw new Error("Memory text cannot be empty");
		if (SENSITIVE_PATTERNS.some((pattern) => pattern.test(cleaned))) {
			throw new Error("Memory looks like it contains a secret; remove credentials before saving it");
		}

		const tagsToWrite = normalizedTags(tags);
		if (scope === "global" && tagsToWrite.length === 0) {
			throw new Error("Global memory requires at least one searchable tag");
		}

		const root = scope === "project" ? this.projectRoot : this.globalRoot;
		const day = new Date().toISOString().slice(0, 10);
		const path = daily ? join(root, "daily", `${day}.md`) : join(root, "MEMORY.md");
		await mkdir(dirname(path), { recursive: true });

		const [canonicalRoot, canonicalParent] = await Promise.all([realpath(root), realpath(dirname(path))]);
		if (!isWithin(canonicalRoot, canonicalParent)) {
			throw new Error("Memory path must stay inside its memory root");
		}

		try {
			const canonicalFile = await realpath(path);
			if (!isWithin(canonicalRoot, canonicalFile)) {
				throw new Error("Memory path must stay inside its memory root");
			}
		} catch (error) {
			if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
			await writeFile(path, daily ? `# ${day}\n` : "# Memory\n", "utf8");
		}

		const tagPrefix = tagsToWrite.map((tag, index) => (index === 0 ? `#${tag}` : `[[${tag}]]`)).join(" ");
		await appendFile(path, `\n- ${tagPrefix ? `${tagPrefix} ` : ""}${cleaned.replace(/\s+/g, " ")}\n`, "utf8");
		await this.sync();
		return path;
	}

	async read(scope: KiokuMemoryScope, requestedPath = "MEMORY.md"): Promise<{ path: string; content: string }> {
		if (scope === "project" && !this.includeProject) {
			throw new Error("Project memory is unavailable until this project is trusted");
		}
		const root = scope === "project" ? this.projectRoot : this.globalRoot;
		const path = resolve(root, requestedPath);
		const lexicalRelative = relative(root, path);
		if (!lexicalRelative || lexicalRelative.startsWith("..") || isAbsolute(lexicalRelative) || basename(path) === "") {
			throw new Error("Memory path must stay inside its memory root");
		}

		try {
			const [canonicalRoot, canonicalPath] = await Promise.all([realpath(root), realpath(path)]);
			if (!isWithin(canonicalRoot, canonicalPath)) {
				throw new Error("Memory path must stay inside its memory root");
			}
			return { path, content: await readFile(canonicalPath, "utf8") };
		} catch (error) {
			if (
				(error as NodeJS.ErrnoException).code === "ENOENT" &&
				scope === "project" &&
				requestedPath === "MEMORY.md"
			) {
				throw new Error(
					"This project has no Kioku MEMORY.md yet. Ask the user whether to create one; do not fall back to global memory.",
				);
			}
			throw error;
		}
	}

	status(): KiokuMemoryStatus {
		return {
			enabled: this.config.enabled,
			scope: this.config.scope,
			...this.store.counts(this.projectRoot),
			databasePath: this.store.databasePath,
			globalRoot: this.globalRoot,
			projectRoot: this.projectRoot,
		};
	}
}
