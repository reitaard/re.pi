#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createReleaseManifest, RELEASE_MANIFEST_FILENAME, writeReleaseManifest } from "../generate-release-manifest.mjs";
import { assertReleaseIdentity, RELEASE_IDENTITY_POLICY } from "../release-identity.mjs";

const CUSTOM_BASE_COMMIT = RELEASE_IDENTITY_POLICY.customBaseCommit;
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
	const filename = runNpm(
		["pack", resolve(root, packagePath), "--ignore-scripts", "--silent", "--pack-destination", destination],
		root,
		true,
	);
	if (!filename) throw new Error(`npm pack did not return a filename for ${packagePath}`);
	return resolve(destination, filename);
}

function copyIfPresent(source, destination) {
	if (existsSync(source)) cpSync(source, destination, { recursive: true });
}

const releaseIdentity = assertReleaseIdentity({ mode: "branch", root });
runNpm(["run", "clean"]);
runNpm(["run", "build:release"]);
const rebuiltIdentity = assertReleaseIdentity({ mode: "branch", root });
if (rebuiltIdentity.commit !== releaseIdentity.commit) throw new Error("Release source changed during the clean build");
const sourceCommit = releaseIdentity.commit;
const releaseManifest = createReleaseManifest(releaseIdentity, { root });
const releaseManifestPaths = RELEASE_IDENTITY_POLICY.packages.map((pkg) =>
	join(root, pkg.directory, "dist", RELEASE_MANIFEST_FILENAME),
);
for (const path of releaseManifestPaths) {
	if (!existsSync(dirname(path))) throw new Error(`Build output is missing for ${path}`);
}
writeReleaseManifest(releaseManifest, releaseManifestPaths);
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
	["@reitaard/repi-orchestrator", packWorkspace("packages/orchestrator", dependencyTarballs)],
	["@reitaard/repi-tui", packWorkspace("packages/tui", dependencyTarballs)],
]);

for (const name of ["dist", "docs", "examples", "containerization.md", "CHANGELOG.md", "README.md"]) {
	copyIfPresent(join(packageSource, name), join(stage, name));
}

const originalManifest = readJson(join(packageSource, "package.json"));
const installManifest = {
	...originalManifest,
	dependencies: { ...originalManifest.dependencies },
	devDependencies: {},
};
for (const [packageName, tarball] of workspaceTarballs) {
	installManifest.dependencies[packageName] = `file:${tarball.replaceAll("\\", "/")}`;
}
delete installManifest.scripts.prepublishOnly;
delete installManifest.scripts.prepare;
writeJson(join(stage, "package.json"), installManifest);

runNpm(
	["install", "--ignore-scripts", "--package-lock=false", "--fund=false", "--audit=false", "--legacy-peer-deps"],
	stage,
);

const bundledDependencies = [...Object.keys(originalManifest.dependencies), ...Object.keys(originalManifest.optionalDependencies ?? {})];
const finalManifest = {
	...installManifest,
	version,
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

const packedFilename = runNpm(
	["pack", ".", "--ignore-scripts", "--silent", "--pack-destination", outputRoot],
	stage,
	true,
);
if (!packedFilename) throw new Error("npm pack did not return the Recode artifact filename");
const artifact = resolve(outputRoot, packedFilename);

process.stdout.write(`Prepared ${finalManifest.name}@${version}\n`);
process.stdout.write(`Source: ${sourceCommit}\n`);
process.stdout.write(`Artifact: ${artifact}\n`);
process.stdout.write(`Artifact file: ${basename(artifact)}\n`);
