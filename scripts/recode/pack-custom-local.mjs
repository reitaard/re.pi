#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const CUSTOM_BASE_COMMIT = "c5ab200bc43993d211e1e97baa0c9abd27c0ce79";
const scriptDir = resolve(fileURLToPath(new URL(".", import.meta.url)));
const root = resolve(scriptDir, "../..");
const npmCli = process.env.npm_execpath;
if (!npmCli) throw new Error("npm_execpath is unavailable; run this script through npm");

function run(command, args, options = {}) {
	const output = execFileSync(command, args, {
		cwd: options.cwd ?? root,
		encoding: "utf8",
		stdio: options.capture ? ["ignore", "pipe", "pipe"] : "inherit",
		env: process.env,
	});
	return typeof output === "string" ? output.trim() : "";
}

function git(args) {
	return run("git", args, { capture: true });
}

function runNpm(args, cwd = root, capture = false) {
	return run(process.execPath, [npmCli, ...args], { cwd, capture });
}

function readJson(path) {
	return JSON.parse(readFileSync(path, "utf8"));
}

function writeJson(path, value) {
	writeFileSync(path, `${JSON.stringify(value, null, "\t")}\n`, "utf8");
}

function packWorkspace(packagePath, destination) {
	const output = runNpm(
		["pack", resolve(root, packagePath), "--ignore-scripts", "--json", "--pack-destination", destination],
		root,
		true,
	);
	const records = JSON.parse(output);
	const filename = records[0]?.filename;
	if (typeof filename !== "string" || !filename) throw new Error(`npm pack did not return a filename for ${packagePath}`);
	return resolve(destination, filename);
}

function copyIfPresent(source, destination) {
	if (existsSync(source)) cpSync(source, destination, { recursive: true });
}

const dirty = git(["status", "--porcelain=v1", "--untracked-files=normal"]);
if (dirty) throw new Error("Refusing to package a checkout with uncommitted files");
run("git", ["merge-base", "--is-ancestor", CUSTOM_BASE_COMMIT, "HEAD"]);

const sourceCommit = git(["rev-parse", "HEAD"]);
const shortCommit = git(["rev-parse", "--short=8", "HEAD"]);
const distance = Number(git(["rev-list", "--count", `${CUSTOM_BASE_COMMIT}..HEAD`]));
const version = process.env.RECODE_PACKAGE_VERSION?.trim() || `0.81.4-repi.2.dev.${distance}.${shortCommit}`;
const outputRoot = resolve(process.env.RECODE_PACKAGE_OUT?.trim() || join(tmpdir(), "recode-custom-package"));
const dependencyTarballs = join(outputRoot, "dependencies");
const stage = join(outputRoot, "stage");
const packageSource = join(root, "packages", "coding-agent");

rmSync(outputRoot, { recursive: true, force: true });
mkdirSync(dependencyTarballs, { recursive: true });
mkdirSync(stage, { recursive: true });

const workspaceTarballs = new Map([
	["@reitaard/repi-ai", packWorkspace("packages/ai", dependencyTarballs)],
	["@reitaard/repi-agent-core", packWorkspace("packages/agent", dependencyTarballs)],
	["@reitaard/repi-tui", packWorkspace("packages/tui", dependencyTarballs)],
]);

for (const name of ["dist", "docs", "examples", "containerization.md", "CHANGELOG.md", "README.md"]) {
	copyIfPresent(join(packageSource, name), join(stage, name));
}

const originalManifest = readJson(join(packageSource, "package.json"));
const installManifest = {
	...originalManifest,
	version,
	dependencies: { ...originalManifest.dependencies },
	devDependencies: {},
};
for (const [packageName, tarball] of workspaceTarballs) {
	installManifest.dependencies[packageName] = `file:${tarball.replaceAll("\\", "/")}`;
}
delete installManifest.scripts.prepublishOnly;
delete installManifest.scripts.prepare;
writeJson(join(stage, "package.json"), installManifest);

runNpm(["install", "--ignore-scripts", "--package-lock=false", "--fund=false", "--audit=false"], stage);

const bundledDependencies = [...Object.keys(originalManifest.dependencies), ...Object.keys(originalManifest.optionalDependencies ?? {})];
const finalManifest = {
	...installManifest,
	dependencies: originalManifest.dependencies,
	bundledDependencies,
	repi: {
		productName: "RePi",
		channel: "development",
		customBaseCommit: CUSTOM_BASE_COMMIT,
		sourceCommit,
	},
};
writeJson(join(stage, "package.json"), finalManifest);

const packedOutput = runNpm(["pack", ".", "--ignore-scripts", "--json", "--pack-destination", outputRoot], stage, true);
const packedRecords = JSON.parse(packedOutput);
const packedFilename = packedRecords[0]?.filename;
if (typeof packedFilename !== "string" || !packedFilename) throw new Error("npm pack did not return the Recode artifact filename");
const artifact = resolve(outputRoot, packedFilename);

process.stdout.write(`Prepared ${finalManifest.name}@${version}\n`);
process.stdout.write(`Source: ${sourceCommit}\n`);
process.stdout.write(`Artifact: ${artifact}\n`);
process.stdout.write(`Artifact file: ${basename(artifact)}\n`);
