import { spawnSync } from "node:child_process";
import { mkdtempSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { deriveRepiBuildInfo, formatRepiVersion } from "./version-core.mjs";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const rootDir = resolve(scriptDir, "../..");
const artifactsDir = join(rootDir, ".artifacts");
const cliArgs = process.argv.slice(2);
const publish = cliArgs.includes("--publish");
const bootstrap = cliArgs.includes("--bootstrap");
const requiredNodePrefix = "26.5.";
const npmRegistry = "https://registry.npmjs.org/";

if (!process.versions.node.startsWith(requiredNodePrefix)) {
	throw new Error(`RePi releases require Node 26.5.x; current runtime is ${process.version}`);
}

if (bootstrap && !publish) {
	throw new Error("--bootstrap is only valid together with --publish");
}

function run(command, args, options = {}) {
	const result = spawnSync(command, args, {
		cwd: options.cwd ?? rootDir,
		encoding: "utf8",
		stdio: options.capture ? ["ignore", "pipe", "pipe"] : "inherit",
		...(options.shell ? { shell: true } : {}),
	});
	if (result.status !== 0) {
		const detail =
			result.stderr?.trim() || result.stdout?.trim() || result.error?.message || `exit code ${result.status}`;
		throw new Error(`${command} ${args.join(" ")} failed: ${detail}`);
	}
	return result.stdout?.trim() ?? "";
}

function git(args, options = {}) {
	return run("git", args, { ...options, capture: options.capture ?? true });
}

function npm(args, options = {}) {
	const npmExecPath = process.env.npm_execpath;
	if (npmExecPath) return run(process.execPath, [npmExecPath, ...args], options);
	if (process.platform === "win32") {
		throw new Error("npm_execpath is unavailable. Run the release through npm run repi:release on Windows.");
	}
	return run("npm", args, options);
}

function npmProbe(args) {
	const npmExecPath = process.env.npm_execpath;
	if (npmExecPath) {
		return spawnSync(process.execPath, [npmExecPath, ...args], {
			cwd: rootDir,
			encoding: "utf8",
			stdio: ["ignore", "pipe", "pipe"],
		});
	}
	return spawnSync("npm", args, {
		cwd: rootDir,
		encoding: "utf8",
		stdio: ["ignore", "pipe", "pipe"],
	});
}

function node(args, options = {}) {
	return run(process.execPath, args, options);
}

function ensureCleanAndPushed() {
	const dirty = git(["status", "--porcelain", "--untracked-files=no"]);
	if (dirty) throw new Error("RePi release requires a clean working tree");
	const upstream = git(["rev-parse", "--abbrev-ref", "--symbolic-full-name", "@{u}"]);
	const head = git(["rev-parse", "HEAD"]);
	const remoteHead = git(["rev-parse", upstream]);
	if (head !== remoteHead) throw new Error(`Push the release commit to ${upstream} before publishing`);
}

function buildReleasePackages() {
	npm(["--prefix", "packages/tui", "run", "build"]);
	npm(["--prefix", "packages/ai", "run", "build"]);
	npm(["--prefix", "packages/agent", "run", "build"]);
	npm(["--prefix", "packages/storage/sqlite-node", "run", "build"]);
	npm(["--prefix", "packages/coding-agent", "run", "build"]);
}

function runReleaseChecks() {
	node(["--test", "scripts/repi-version.test.mjs", "scripts/repi-release-package.test.mjs"]);
	buildReleasePackages();
	npm([
		"--prefix",
		"packages/coding-agent",
		"test",
		"--",
		"test/repi-update-release.test.ts",
		"test/repi-update-command.test.ts",
		"test/repi-update-notifier.test.ts",
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
		npm(["install", "--prefix", prefix, "--ignore-scripts", tarball]);
		const [scope, name] = packageName.startsWith("@") ? packageName.split("/") : [undefined, packageName];
		const packageRoot = scope ? join(prefix, "node_modules", scope, name) : join(prefix, "node_modules", name);
		const output = node([join(packageRoot, "dist", "recode-cli.js"), "--version"], { capture: true });
		if (!output.includes(expectedVersion)) {
			throw new Error(`Packed Recode reported an unexpected version: ${output}`);
		}
		console.log(`Smoke test passed: ${output.replace(/\r?\n/g, " | ")}`);
	} finally {
		rmSync(prefix, { recursive: true, force: true });
	}
}

function installBootstrapTarball(tarball, expectedVersion) {
	console.log(`Installing tested Recode bootstrap ${expectedVersion}...`);
	npm(["install", "-g", "--ignore-scripts", tarball]);
	const command = process.platform === "win32" ? "recode.cmd" : "recode";
	const output = run(command, ["--version"], {
		capture: true,
		...(process.platform === "win32" ? { shell: true } : {}),
	});
	if (!output.includes(expectedVersion)) {
		throw new Error(`Global Recode bootstrap reported an unexpected version: ${output}`);
	}
	console.log(`Bootstrap active: ${output.replace(/\r?\n/g, " | ")}`);
}

function publishedVersion(packageName, version) {
	const result = npmProbe([
		"view",
		`${packageName}@${version}`,
		"version",
		"--registry",
		npmRegistry,
		"--prefer-online",
	]);
	return result.status === 0 && result.stdout.trim() === version;
}

function waitForLatestDistTag(packageName, expectedVersion) {
	for (let attempt = 0; attempt < 90; attempt += 1) {
		const result = npmProbe([
			"view",
			packageName,
			"dist-tags.latest",
			"--registry",
			npmRegistry,
			"--prefer-online",
		]);
		if (result.status === 0 && result.stdout.trim() === expectedVersion) return;
		Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 2000);
	}
	throw new Error(`Published package did not expose latest=${expectedVersion} within 180 seconds`);
}

function deleteLocalTag(tag) {
	spawnSync("git", ["tag", "-d", tag], { cwd: rootDir, stdio: "ignore" });
}

ensureCleanAndPushed();
let buildInfo = deriveRepiBuildInfo(rootDir);
const startedTagged = buildInfo.release;
const releaseVersion = startedTagged
	? buildInfo.version
	: formatRepiVersion({
			upstreamVersion: buildInfo.upstreamVersion,
			revision: buildInfo.revision,
			release: true,
		});
const tag = buildInfo.releaseTag;

console.log(`RePi release candidate: ${releaseVersion}`);
console.log(`Tag: ${tag}`);

let developmentTarball;
if (!startedTagged) {
	runReleaseChecks();
	node(["scripts/repi/prepare-release-package.mjs", "--pack", "--skip-build"]);
	developmentTarball = packageTarball(buildInfo.version);
	smokeTestTarball(developmentTarball, buildInfo.version, buildInfo.packageName);
}

if (!publish) {
	console.log("Dry release passed. Run npm run repi:release -- --publish when the complete release is ready.");
	process.exit(0);
}

npm(["whoami"], { capture: true });

let packageIsPublished = publishedVersion(buildInfo.packageName, releaseVersion);
if (!packageIsPublished && startedTagged) {
	console.log(`Resuming unpublished tagged release ${releaseVersion}.`);
}

try {
	if (!startedTagged) {
		if (bootstrap && developmentTarball) installBootstrapTarball(developmentTarball, buildInfo.version);
		git(["tag", "-a", tag, "-m", `RePi ${releaseVersion}`], { capture: false });
		buildInfo = deriveRepiBuildInfo(rootDir);
		if (!buildInfo.release || buildInfo.version !== releaseVersion) {
			throw new Error(`Release tag did not produce the expected version: ${buildInfo.version}`);
		}
	}

	if (!packageIsPublished) {
		npm(["--prefix", "packages/coding-agent", "run", "build"]);
		node(["scripts/repi/prepare-release-package.mjs", "--pack", "--skip-build"]);
		const tarball = packageTarball(releaseVersion);
		smokeTestTarball(tarball, releaseVersion, buildInfo.packageName);
		npm(["publish", tarball, "--access", "public", "--tag", "latest"]);
		packageIsPublished = true;
		waitForLatestDistTag(buildInfo.packageName, releaseVersion);
		console.log(`Published ${buildInfo.packageName}@${releaseVersion}`);
	} else {
		console.log(`${buildInfo.packageName}@${releaseVersion} is already published; resuming tag finalization.`);
		waitForLatestDistTag(buildInfo.packageName, releaseVersion);
	}

	git(["push", "origin", tag], { capture: false });
	console.log(`Pushed ${tag}`);
	if (bootstrap) {
		console.log("The development bootstrap remains installed so the real TUI update notice can be tested now.");
	}
	console.log("The Recode TUI update notice and `recode update` command can now resolve this release.");
} catch (error) {
	if (!packageIsPublished) {
		deleteLocalTag(tag);
		console.error(`Release publication failed before npm confirmed ${releaseVersion}; removed local tag ${tag}.`);
	} else {
		console.error(`npm already contains ${buildInfo.packageName}@${releaseVersion}; keep local tag ${tag} and rerun to finish pushing it.`);
	}
	throw error;
}
