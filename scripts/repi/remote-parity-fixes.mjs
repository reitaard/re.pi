import { execFileSync } from "node:child_process";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

const LEGACY_REF = "origin/oauth-test";

function legacyFile(path) {
	return execFileSync("git", ["show", `${LEGACY_REF}:${path}`], { encoding: "utf8" });
}

async function write(path, content) {
	await mkdir(dirname(path), { recursive: true });
	await writeFile(path, content, "utf8");
}

const cachedOutputPath = "packages/coding-agent/src/modes/interactive/components/cached-output-block.ts";
await write(
	cachedOutputPath,
	legacyFile(cachedOutputPath).replaceAll("@reitaard/repi-tui", "@earendil-works/pi-tui"),
);

const lspDirectory = "packages/coding-agent/src/lsp";
for (const entry of await readdir(lspDirectory, { withFileTypes: true })) {
	if (!entry.isFile() || !entry.name.endsWith(".ts")) continue;
	const path = join(lspDirectory, entry.name);
	let content = await readFile(path, "utf8");
	content = content
		.replaceAll('"toolSuccessStatus"', '"success"')
		.replaceAll('"toolErrorStatus"', '"error"');
	await write(path, content);
}
