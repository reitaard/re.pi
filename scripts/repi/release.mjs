import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { deriveRepiBuildInfo, formatRepiVersion } from "./version-core.mjs";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const rootDir = resolve(scriptDir, "../..");
const artifactsDir = join(rootDir, ".artifacts");
const publish = process.argv.slice(2).includes("--publish");

function run(command, args, options = {}) {
	const result = spawnSync(command, args, {
		cwd: options.cwd ?? rootDir,
		encoding: "utf8",
		stdio: options.capture ? ["ignore", "pipe", "pipe"] : "inherit",
	});
	if (result.status !== 0) {
		const detail = result.stderr?.trim() || result.stdout?.trim() || result.error?.message || `exit code ${result.status}`;
		throw new Error(`${command} ${args.join(" ")} failed: ${detail}`);
	}
	return result.stdout?.trim() ?? "";
}

function git(args, options = {}) {
	return run("git", args, { ...options, capture: options.capture ?? true });
}

function ensureCleanAndPushed() {
	const dirty = git(["status", "--porcelain", "--untracked-files=no"]);
	if (dirty) throw new Error("RePi release requires a clean working tree");
	const upstream = git(["rev-parse", "--abbrev-ref", "--symbolic-full-name", "@{u}"]);
	const head = git(["rev-parse", "HEAD"]);
	const remoteHead = git(["rev-parse", upstream]);
	if (head !== remoteHead) throw new Error(`Push the release commit to ${upstream} before publishing`);
}

function runReleaseChecks() {
	run("node", ["--test", "scripts/repi-version.test.mjs", "scripts/repi-release-package.test.mjs"]);
	run("npm", ["--prefix", "packages/ai", "run", "build:offline"]);
	run("npm", ["--prefix", "packages/coding-agent", "run", "build"]);
	run("npm", [
		"--prefix",
		"packages/coding-agent",
		"test",
		"--",
		"test/repi-update-release.test.ts",
		"test/repi-update-command.test.ts",
		"test/repi-open-provider.test.ts",
		"test/repi-openai-oauth.test.ts",
		"test/repi-kioku-config.test.ts",
		"test/repi-kioku-memory.test.ts",
	]);
}

function packageTarball(version) {
	const suffix = `-${version}.tgz`;
	const candidates = readdirSync(artifactsDir)
		.filter((name) => name.endsWith(suffix))
		.sort();
	const filename = candidates.at(-1);
	if (!filename) throw new Error(`Could not find packed RePi artifact ending in ${suffix}`);
	return join(artifactsDir, filename);
}

function smokeTestTarball(tarball, expectedVersion, packageName) {
	const prefix = mkdtempSync(join(tmpdir(), "repi-release-smoke-"));
	try {
		run("npm", ["install", "--prefix", prefix, "--ignore-scripts", tarball]);
		const [scope, name] = packageName.startsWith("@") ? packageName.split("/") : [undefined, packageName];
		const packageRoot = scope
			? join(prefix, "node_modules", scope, name)
			: join(prefix, "node_modules", name);
		const output = run("node", [join(packageRoot, "dist", "recode-cli.js"), "--version"], { capture: true });
		if (!output.includes(expectedVersion)) {
			throw new Error(`Packed Recode reported an unexpected version: ${output}`);
		}
		console.log(`Smoke test passed: ${output.replace(/\r?\n/g, " | ")}`);
	} finally {
		rmSync(prefix, { recursive: true, force: true });
	}
}

ensureCleanAndPushed();
let buildInfo = deriveRepiBuildInfo(rootDir);
if (buildInfo.release) throw new Error(`HEAD is already release-tagged as ${buildInfo.releaseTag}`);

const releaseVersion = formatRepiVersion({
	upstreamVersion: buildInfo.upstreamVersion,
	revision: buildInfo.revision,
	release: true,
});
console.log(`RePi release candidate: ${releaseVersion}`);
console.log(`Tag: ${buildInfo.releaseTag}`);

runReleaseChecks();

if (!publish) {
	run("node", ["scripts/repi/prepare-release-package.mjs", "--pack", "--skip-build"]);
	const developmentTarball = packageTarball(buildInfo.version);
	smokeTestTarball(developmentTarball, buildInfo.version, buildInfo.packageName);
	console.log("Dry release passed. Run npm run repi:release -- --publish when the complete release is ready.");
	process.exit(0);
}

run("npm", ["whoami"], { capture: true });
const published = spawnSync("npm", ["view", `${buildInfo.packageName}@${releaseVersion}`, "version"], {
	cwd: rootDir,
	encoding: "utf8",
	stdio: ["ignore", "pipe", "pipe"],
});
if (published.status === 0 && published.stdout.trim() === releaseVersion) {
	throw new Error(`${buildInfo.packageName}@${releaseVersion} is already published`);
}

const tag = buildInfo.releaseTag;
git(["tag", "-a", tag, "-m", `RePi ${releaseVersion}`], { capture: false });
try {
	buildInfo = deriveRepiBuildInfo(rootDir);
	if (!buildInfo.release || buildInfo.version !== releaseVersion) {
		throw new Error(`Release tag did not produce the expected version: ${buildInfo.version}`);
	}
	run("npm", ["--prefix", "packages/coding-agent", "run", "build"]);
	run("node", ["scripts/repi/prepare-release-package.mjs", "--pack", "--skip-build"]);
	const tarball = packageTarball(releaseVersion);
	smokeTestTarball(tarball, releaseVersion, buildInfo.packageName);
	git(["push", "origin", tag], { capture: false });
	run("npm", ["publish", tarball, "--access", "public", "--tag", "latest"]);
	console.log(`Published ${buildInfo.packageName}@${releaseVersion}`);
	console.log("The Recode TUI update notice and `recode update` command can now resolve this release.");
} catch (error) {
	const remoteTag = execFileSync("git", ["ls-remote", "--tags", "origin", `refs/tags/${tag}`], {
		cwd: rootDir,
		encoding: "utf8",
	}).trim();
	if (!remoteTag) {
		spawnSync("git", ["tag", "-d", tag], { cwd: rootDir, stdio: "ignore" });
	}
	throw error;
}
