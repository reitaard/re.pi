import { mkdir, mkdtemp, readFile, rm, unlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { chunkRecodeMemory } from "../src/core/recode-memory/recode-memory-chunker.ts";
import { RecodeMemoryManager } from "../src/core/recode-memory/recode-memory-manager.ts";
import { normalizeRecodeMemoryConfig, resolveAutomaticMemoryScope } from "../src/recode-memory.ts";

const roots: string[] = [];
const managers: RecodeMemoryManager[] = [];

afterEach(async () => {
	for (const manager of managers.splice(0)) manager.close();
	await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

function createManager(root: string): RecodeMemoryManager {
	const manager = new RecodeMemoryManager({
		globalRoot: join(root, "global"),
		projectRoot: join(root, "project", ".pi", "memory"),
		databasePath: join(root, "agent", "recode-memory.sqlite"),
		config: {
			enabled: true,
			scope: "both",
			autoRecall: true,
			globalAccess: false,
			globalAutoRecall: false,
			cardinalRouting: "auto",
			shioriThinking: false,
			maxResults: 6,
			maxInjectedCharacters: 6000,
		},
	});
	managers.push(manager);
	return manager;
}

describe("re.code core memory", () => {
	it("migrates the legacy global recall switch into separate safe controls", () => {
		expect(normalizeRecodeMemoryConfig({ globalRecall: true })).toMatchObject({
			globalAccess: true,
			globalAutoRecall: true,
		});
		expect(normalizeRecodeMemoryConfig({ globalAccess: false, globalAutoRecall: true })).toMatchObject({
			globalAccess: false,
			globalAutoRecall: false,
		});
		expect(normalizeRecodeMemoryConfig({ globalAccess: true, globalAutoRecall: false })).toMatchObject({
			globalAccess: true,
			globalAutoRecall: false,
		});
	});

	it("keeps explicit global access independent from automatic prompt recall", () => {
		const explicitOnly = normalizeRecodeMemoryConfig({
			autoRecall: true,
			globalAccess: true,
			globalAutoRecall: false,
		});
		expect(resolveAutomaticMemoryScope(explicitOnly, true)).toBe("project");

		const globalOnly = normalizeRecodeMemoryConfig({
			autoRecall: false,
			globalAccess: true,
			globalAutoRecall: true,
		});
		expect(resolveAutomaticMemoryScope(globalOnly, true)).toBe("global");
		expect(resolveAutomaticMemoryScope(globalOnly, false)).toBeUndefined();
	});

	it("chunks long Markdown with line citations and bounded overlap", () => {
		const content = Array.from(
			{ length: 120 },
			(_, index) => `Line ${index + 1}: durable project fact ${index + 1}.`,
		).join("\n");
		const chunks = chunkRecodeMemory("document", "project", "MEMORY.md", content);

		expect(chunks.length).toBeGreaterThan(1);
		expect(chunks[0]).toMatchObject({ lineStart: 1, scope: "project", path: "MEMORY.md" });
		expect(chunks[1].lineStart).toBeLessThanOrEqual(chunks[0].lineEnd);
		expect(chunks.at(-1)?.lineEnd).toBe(120);
		expect(chunks.every((chunk) => chunk.tokenCount > 0 && chunk.id.length === 24)).toBe(true);
	});

	it("indexes, searches, updates, and removes Markdown memory incrementally", async () => {
		const root = await mkdtemp(join(tmpdir(), "repi-memory-"));
		roots.push(root);
		const manager = createManager(root);
		await manager.initialize();

		const projectFile = join(manager.projectRoot, "architecture.md");
		await mkdir(manager.projectRoot, { recursive: true });
		await writeFile(projectFile, "# Architecture\n\nUse SQLite FTS5 for fast durable memory retrieval.\n", "utf8");
		const firstSync = await manager.sync();
		expect(firstSync.indexed).toBe(1);

		const results = await manager.search("SQLite durable retrieval");
		expect(results[0]).toMatchObject({ scope: "project", lineStart: 1 });
		expect(results[0].text).toContain("FTS5");

		await writeFile(projectFile, "# Architecture\n\nUse Markdown as the canonical memory source.\n", "utf8");
		await manager.sync();
		expect(await manager.search("SQLite FTS5")).toEqual([]);
		expect((await manager.search("canonical memory source"))[0]?.text).toContain("Markdown");

		await unlink(projectFile);
		await manager.sync();
		expect(await manager.search("FTS5")).toEqual([]);

		const otherProject = new RecodeMemoryManager({
			globalRoot: manager.globalRoot,
			projectRoot: join(root, "other-project", ".pi", "memory"),
			databasePath: manager.store.databasePath,
			config: manager.getConfig(),
		});
		managers.push(otherProject);
		await otherProject.initialize();
		await otherProject.write("project", "The nebula deployment belongs only to the other project.");
		expect(await manager.search("nebula deployment")).toEqual([]);
		expect((await otherProject.search("nebula deployment"))[0]?.text).toContain("other project");
	});

	it("writes only inside memory roots and rejects obvious secrets", async () => {
		const root = await mkdtemp(join(tmpdir(), "repi-memory-"));
		roots.push(root);
		const manager = createManager(root);
		await manager.initialize();

		const path = await manager.write("project", "Prefer focused tests for adapted memory code.");
		expect(await readFile(path, "utf8")).toContain("Prefer focused tests");
		await expect(manager.write("global", "api_key=super-secret-value-1234")).rejects.toThrow("secret");
		await expect(manager.read("project", "../../outside.md")).rejects.toThrow("inside its memory root");
	});

	it("keeps recall database-only and reconciles external Markdown changes in the background", async () => {
		const root = await mkdtemp(join(tmpdir(), "repi-memory-"));
		roots.push(root);
		const manager = createManager(root);
		await manager.initialize();

		const syncSpy = vi.spyOn(manager, "sync");
		expect(await manager.search("not indexed yet")).toEqual([]);
		expect(syncSpy).not.toHaveBeenCalled();

		await writeFile(
			join(manager.projectRoot, "external.md"),
			"# Decision\n\nUse a dirty queue for indexing.\n",
			"utf8",
		);
		await vi.waitFor(async () => {
			expect((await manager.search("dirty queue"))[0]?.text).toContain("dirty queue");
		});
	});

	it("requires and indexes searchable tags for global memory", async () => {
		const root = await mkdtemp(join(tmpdir(), "repi-memory-"));
		roots.push(root);
		const manager = createManager(root);
		await manager.initialize();

		await expect(manager.write("global", "Prefer pnpm for packages.")).rejects.toThrow("searchable tag");
		const path = await manager.write("global", "Prefer pnpm for packages.", false, true, [
			"preference",
			"package-manager",
		]);
		expect(await readFile(path, "utf8")).toContain("#preference [[package-manager]] Prefer pnpm");
		expect((await manager.search("package-manager", 6, "global"))[0]?.scope).toBe("global");
	});
});
