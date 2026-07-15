import { createHash } from "node:crypto";
import type { Dirent } from "node:fs";
import { appendFile, mkdir, readdir, readFile, stat, writeFile } from "node:fs/promises";
import { basename, dirname, join, relative, resolve } from "node:path";
import { chunkRecodeMemory, recodeMemoryDocumentId } from "./recode-memory-chunker.ts";
import { RecodeMemoryStore } from "./recode-memory-store.ts";
import type {
	RecodeMemoryConfig,
	RecodeMemoryScope,
	RecodeMemorySearchResult,
	RecodeMemoryStatus,
} from "./recode-memory-types.ts";

interface MemoryFile {
	scope: RecodeMemoryScope;
	path: string;
}

const SENSITIVE_PATTERNS = [
	/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/i,
	/\b(?:api[_-]?key|access[_-]?token|client[_-]?secret|password)\s*[:=]\s*\S{8,}/i,
	/\b(?:sk|ghp|github_pat)_[A-Za-z0-9_-]{16,}\b/,
];

async function markdownFiles(root: string, scope: RecodeMemoryScope): Promise<MemoryFile[]> {
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
			if (entry.isDirectory()) await walk(path);
			else if (entry.isFile() && entry.name.toLowerCase().endsWith(".md")) found.push({ scope, path });
		}
	}
	await walk(root);
	return found;
}

export class RecodeMemoryManager {
	readonly globalRoot: string;
	readonly projectRoot: string;
	readonly store: RecodeMemoryStore;
	private config: RecodeMemoryConfig;

	constructor(options: {
		globalRoot: string;
		projectRoot: string;
		databasePath: string;
		config: RecodeMemoryConfig;
	}) {
		this.globalRoot = resolve(options.globalRoot);
		this.projectRoot = resolve(options.projectRoot);
		this.store = new RecodeMemoryStore(options.databasePath);
		this.config = options.config;
	}

	async initialize(includeProject = true): Promise<void> {
		await Promise.all([mkdir(this.globalRoot, { recursive: true }), this.store.open()]);
		await this.sync(includeProject);
	}

	close(): void {
		this.store.close();
	}

	getConfig(): RecodeMemoryConfig {
		return { ...this.config };
	}

	setConfig(config: RecodeMemoryConfig): void {
		this.config = config;
	}

	async sync(includeProject = true): Promise<{ indexed: number; unchanged: number }> {
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
			const id = recodeMemoryDocumentId(file.scope, path);
			this.store.replaceDocument(
				{ id, scope: file.scope, path, hash, mtimeMs: info.mtimeMs },
				chunkRecodeMemory(id, file.scope, path, content),
			);
			indexed += 1;
		}
		this.store.removeMissing(existing, includeProject ? [this.globalRoot, this.projectRoot] : [this.globalRoot]);
		return { indexed, unchanged };
	}

	async search(
		query: string,
		limit = this.config.maxResults,
		scope = this.config.scope,
	): Promise<RecodeMemorySearchResult[]> {
		if (!this.config.enabled) return [];
		await this.sync(scope !== "global");
		return this.store.search(query, scope, Math.floor(Math.max(1, Math.min(limit, 20))), this.projectRoot);
	}

	async write(scope: RecodeMemoryScope, text: string, daily = false, includeProject = true): Promise<string> {
		const cleaned = text.trim();
		if (!cleaned) throw new Error("Memory text cannot be empty");
		if (SENSITIVE_PATTERNS.some((pattern) => pattern.test(cleaned))) {
			throw new Error("Memory looks like it contains a secret; remove credentials before saving it");
		}
		const root = scope === "project" ? this.projectRoot : this.globalRoot;
		const day = new Date().toISOString().slice(0, 10);
		const path = daily ? join(root, "daily", `${day}.md`) : join(root, "MEMORY.md");
		await mkdir(dirname(path), { recursive: true });
		try {
			await stat(path);
		} catch {
			await writeFile(path, daily ? `# ${day}\n` : "# Memory\n", "utf8");
		}
		await appendFile(path, `\n- ${cleaned.replace(/\s+/g, " ")}\n`, "utf8");
		await this.sync(includeProject);
		return path;
	}

	async read(scope: RecodeMemoryScope, requestedPath = "MEMORY.md"): Promise<{ path: string; content: string }> {
		const root = scope === "project" ? this.projectRoot : this.globalRoot;
		const path = resolve(root, requestedPath);
		const relativePath = relative(root, path);
		if (relativePath.startsWith("..") || relativePath.includes(":") || basename(path) === "") {
			throw new Error("Memory path must stay inside its memory root");
		}
		return { path, content: await readFile(path, "utf8") };
	}

	status(): RecodeMemoryStatus {
		return {
			enabled: this.config.enabled,
			scope: this.config.scope,
			...this.store.counts(),
			databasePath: this.store.databasePath,
			globalRoot: this.globalRoot,
			projectRoot: this.projectRoot,
		};
	}
}
