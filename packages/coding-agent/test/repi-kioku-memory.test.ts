import { mkdir, mkdtemp, readFile, rm, unlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { chunkKiokuMemory } from "../src/repi/memory/chunker.ts";
import { KiokuMemoryManager } from "../src/repi/memory/manager.ts";
import { resolveKiokuMemoryLocation } from "../src/repi/memory/runtime.ts";
import type { KiokuMemoryConfig } from "../src/repi/memory/types.ts";

const roots: string[] = [];
const managers: KiokuMemoryManager[] = [];

const CONFIG: KiokuMemoryConfig = {
	enabled: true,
	scope: "project",
	autoRecall: true,
	globalAccess: false,
	globalAutoRecall: false,
	maxResults: 6,
	maxInjectedCharacters: 6000,
};

afterEach(async () => {
	for (const manager of managers.splice(0)) manager.close();
	await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

function createManager(root: string, projectName = "project"): KiokuMemoryManager {
	const manager = new KiokuMemoryManager({
		globalRoot: join(root, "agent", "memory"),
		projectRoot: join(root, projectName, ".pi", "memory"),
		databasePath: join(root, "agent", "recode-memory.sqlite"),
		config: CONFIG,
	});
	managers.push(manager);
	return manager;
}

describe("RePi Kioku memory", () => {
	it("chunks Markdown with line citations and bounded overlap", () => {
		const content = Array.from(
			{ length: 120 },
			(_, index) => `Line ${index + 1}: durable project fact ${index + 1}.`,
		).join("\n");
		const chunks = chunkKiokuMemory("document", "project", "MEMORY.md", content);

		expect(chunks.length).toBeGreaterThan(1);
		expect(chunks[0]).toMatchObject({ lineStart: 1, scope: "project", path: "MEMORY.md" });
		expect(chunks[1].lineStart).toBeLessThanOrEqual(chunks[0].lineEnd);
		expect(chunks.at(-1)?.lineEnd).toBe(120);
		expect(chunks.every((chunk) => chunk.tokenCount > 0 && chunk.id.length === 24)).toBe(true);
	});

	it("indexes, searches, updates, removes, and isolates project Markdown", async () => {
		const root = await mkdtemp(join(tmpdir(), "repi-kioku-"));
		roots.push(root);
		const manager = createManager(root);
		await manager.initialize();

		const projectFile = join(manager.projectRoot, "architecture.md");
		await mkdir(manager.projectRoot, { recursive: true });
		await writeFile(projectFile, "# Architecture\n\nUse SQLite FTS5 for fast durable recall.\n", "utf8");
		expect((await manager.sync()).indexed).toBe(1);
		expect((await manager.search("SQLite durable recall"))[0]).toMatchObject({ scope: "project", lineStart: 1 });

		await writeFile(projectFile, "# Architecture\n\nUse Markdown as the canonical memory source.\n", "utf8");
		await manager.sync();
		expect(await manager.search("SQLite FTS5")).toEqual([]);
		expect((await manager.search("canonical memory source"))[0]?.text).toContain("Markdown");

		await unlink(projectFile);
		await manager.sync();
		expect(await manager.search("canonical memory source")).toEqual([]);

		const otherProject = createManager(root, "other-project");
		await otherProject.initialize();
		await otherProject.write("project", "The nebula deployment belongs only to the other project.");
		expect(await manager.search("nebula deployment")).toEqual([]);
		expect((await otherProject.search("nebula deployment"))[0]?.text).toContain("other project");
	});

	it("guards writes, global tags, and memory-root boundaries", async () => {
		const root = await mkdtemp(join(tmpdir(), "repi-kioku-"));
		roots.push(root);
		const manager = createManager(root);
		await manager.initialize();

		const projectPath = await manager.write("project", "Prefer focused tests for adapted memory code.");
		expect(await readFile(projectPath, "utf8")).toContain("Prefer focused tests");
		await expect(manager.write("global", "A durable preference without a tag.")).rejects.toThrow("tag");
		const globalPath = await manager.write("global", "Prefer compact provider logs.", false, ["preference", "logging"]);
		expect(await readFile(globalPath, "utf8")).toContain("#preference [[logging]]");
		await expect(manager.write("global", "api_key=super-secret-value-1234", false, ["secret"])).rejects.toThrow(
			"secret",
		);
		await expect(manager.read("project", "../../outside.md")).rejects.toThrow("inside its memory root");
	});

	it("maps a Kioku memory working directory back to its project root", () => {
		const project = join(tmpdir(), "kioku-project");
		const memory = join(project, ".pi", "memory");
		expect(resolveKiokuMemoryLocation(memory)).toEqual({ managerKey: project, projectMemoryRoot: memory });
	});
});
