import { execFileSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createRepiPackageManifest } from "./release-package-core.mjs";
import { deriveRepiBuildInfo } from "./version-core.mjs";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const rootDir = resolve(scriptDir, "../..");
const codingAgentDir = join(rootDir, "packages", "coding-agent");
const artifactsDir = join(rootDir, ".artifacts");
const stageDir = join(artifactsDir, "repi-package");
const args = new Set(process.argv.slice(2));
const shouldPack = args.has("--pack") || args.has("--publish");
const shouldPublish = args.has("--publish");
const skipBuild = args.has("--skip-build");

function run(command, commandArgs, options = {}) {
	return execFileSync(command, commandArgs, {
		cwd: options.cwd ?? rootDir,
		encoding: "utf8",
		stdio: options.capture ? ["ignore", "pipe", "inherit"] : "inherit",
	});
}

function copyIfPresent(source, destination) {
	if (!existsSync(source)) return;
	mkdirSync(dirname(destination), { recursive: true });
	cpSync(source, destination, { recursive: true });
}

function readReleaseNote() {
	const path = join(rootDir, "repi", "release-note.md");
	return existsSync(path) ? readFileSync(path, "utf8").trim() : undefined;
}

let buildInfo = deriveRepiBuildInfo(rootDir);
if (shouldPublish && (!buildInfo.release || buildInfo.dirty)) {
	throw new Error(
		`Publishing requires a clean commit tagged exactly ${buildInfo.releaseTag}. Current version is ${buildInfo.version}.`,
	);
}

if (!skipBuild) {
	run("npm", ["--prefix", "packages/coding-agent", "run", "build"]);
	buildInfo = deriveRepiBuildInfo(rootDir);
}

const generatedBuildInfoPath = join(codingAgentDir, "dist", "repi-build-info.json");
if (!existsSync(generatedBuildInfoPath)) {
	throw new Error("Missing dist/repi-build-info.json. Build packages/coding-agent before packaging RePi.");
}
const generatedBuildInfo = JSON.parse(readFileSync(generatedBuildInfoPath, "utf8"));
if (generatedBuildInfo.version !== buildInfo.version || generatedBuildInfo.sourceCommit !== buildInfo.sourceCommit) {
	throw new Error(
		`Generated build metadata is stale (${generatedBuildInfo.version ?? "unknown"}); expected ${buildInfo.version}.`,
	);
}

rmSync(stageDir, { recursive: true, force: true });
mkdirSync(stageDir, { recursive: true });

const sourceManifest = JSON.parse(readFileSync(join(codingAgentDir, "package.json"), "utf8"));
const releaseManifest = createRepiPackageManifest(sourceManifest, buildInfo, { note: readReleaseNote() });
writeFileSync(join(stageDir, "package.json"), `${JSON.stringify(releaseManifest, null, "\t")}\n`, "utf8");

for (const entry of ["dist", "docs", "examples", "README.md", "CHANGELOG.md", "containerization.md"]) {
	copyIfPresent(join(codingAgentDir, entry), join(stageDir, entry));
}
copyIfPresent(join(rootDir, "LICENSE"), join(stageDir, "LICENSE"));
copyIfPresent(join(rootDir, "repi", "memory.md"), join(stageDir, "docs", "repi-memory.md"));
copyIfPresent(join(rootDir, "repi", "README.md"), join(stageDir, "REPI.md"));

console.log(`Prepared ${releaseManifest.name}@${releaseManifest.version}`);
console.log(`Stage: ${stageDir}`);

if (shouldPack) {
	mkdirSync(artifactsDir, { recursive: true });
	const output = run("npm", ["pack", "--json", "--pack-destination", artifactsDir], {
		cwd: stageDir,
		capture: true,
	});
	const result = JSON.parse(output);
	const filename = Array.isArray(result) ? result[0]?.filename : undefined;
	console.log(`Packed: ${filename ? join(artifactsDir, filename) : "npm pack completed"}`);
}

if (shouldPublish) {
	run("npm", ["publish", "--access", "public", "--tag", "latest"], { cwd: stageDir });
	console.log(`Published ${releaseManifest.name}@${releaseManifest.version} with dist-tag latest`);
}
