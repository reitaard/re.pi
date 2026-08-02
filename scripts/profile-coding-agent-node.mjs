import { execFileSync, spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { arch, platform, release, tmpdir } from "node:os";
import { basename, dirname, join, relative, resolve } from "node:path";
import { performance } from "node:perf_hooks";
import { fileURLToPath } from "node:url";
import {
	createStartupArtifact,
	flattenStartupTimings,
	parseStartupMilestones,
	parseStartupTimings,
	redactTimingGroups,
} from "./profile-startup-artifact.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "..");
const packageDir = join(repoRoot, "packages", "coding-agent");
const distCliPath = join(packageDir, "dist", "cli.js");
const srcCliPath = join(packageDir, "src", "cli.ts");
const defaultNodeProfileDir = join(repoRoot, "profiles-node");
const defaultBunProfileDir = join(repoRoot, "profiles-bun");
const agentDirEnvName = "PI_CODING_AGENT_DIR";
const startupBenchmarkEnvName = "PI_STARTUP_BENCHMARK";

function printHelp() {
	console.log(`Usage:
  node scripts/profile-coding-agent-node.mjs [options]

Profiles coding-agent startup with the runtime selected below:
- npm run profile:tui     -> builds packages/coding-agent and profiles TUI startup with Node
- npm run profile:rpc     -> builds packages/coding-agent and profiles RPC startup with Node
- bun run profile:tui     -> profiles TUI startup from src/cli.ts directly with Bun
- bun run profile:rpc     -> profiles RPC startup from src/cli.ts directly with Bun

Options:
  --mode <name>          tui or rpc (default: tui)
  --runs <n>             Number of measured runs (default: 1)
  --warmup <n>           Number of warmup runs before measurements (default: 0)
  --profile-dir <dir>    CPU profile output directory
                         Default: profiles-node for Node, profiles-bun for Bun
  --label <name>         Profile name prefix (default: <mode>-startup)
  --runtime <name>       node, bun, or auto (default: auto)
  --agent-dir <dir>      Use a specific PI_CODING_AGENT_DIR for the benchmark run
  --isolated-agent-dir   Use a fresh temporary agent dir instead of the normal one
  --artifact-dir <dir>   Write one redacted JSON artifact for every child run
  --cache-state <name>   uncontrolled, cold, or warm (default: uncontrolled)
  --no-offline           Do not force PI_OFFLINE=1 / PI_SKIP_VERSION_CHECK=1
  --skip-build           Reuse the current dist/cli.js without rebuilding first (Node only)
  --cpu-profile          Write CPU profiles for benchmark runs
  --help                 Show this help

Notes:
  - By default the benchmark uses your normal configured agent dir, so global models/auth/settings work.
  - TUI mode injects a unique sentinel after input readiness and measures its first rendered echo.
  - RPC mode measures startup until a real get_state request receives a response, then closes stdin to exit cleanly.
  - CPU profiles are kept in the selected profile directory for later analysis.
`);
}

function parseIntegerFlag(value, name) {
	const parsed = Number.parseInt(value, 10);
	if (!Number.isFinite(parsed) || parsed < 0) {
		throw new Error(`Invalid ${name}: ${value}`);
	}
	return parsed;
}

function parseRuntime(value) {
	if (value === "auto" || value === "node" || value === "bun") {
		return value;
	}
	throw new Error(`Invalid --runtime: ${value}`);
}

function parseMode(value) {
	if (value === "tui" || value === "rpc") {
		return value;
	}
	throw new Error(`Invalid --mode: ${value}`);
}

function parseArgs(argv) {
	const options = {
		mode: "tui",
		runs: 1,
		warmup: 0,
		profileDir: undefined,
		label: undefined,
		offline: true,
		build: true,
		runtime: "auto",
		agentDir: undefined,
		isolatedAgentDir: false,
		artifactDir: undefined,
		cacheState: "uncontrolled",
		cpuProfile: false,
	};

	for (let index = 0; index < argv.length; index++) {
		const arg = argv[index];

		if (arg === "--help" || arg === "-h") {
			options.help = true;
			continue;
		}

		if (arg === "--no-offline") {
			options.offline = false;
			continue;
		}

		if (arg === "--isolated-agent-dir") {
			options.isolatedAgentDir = true;
			continue;
		}

		if (arg === "--skip-build") {
			options.build = false;
			continue;
		}

		if (arg === "--cpu-profile") {
			options.cpuProfile = true;
			continue;
		}

		if (
			(arg === "--mode" ||
				arg === "--runs" ||
				arg === "--warmup" ||
				arg === "--profile-dir" ||
				arg === "--label" ||
				arg === "--runtime" ||
				arg === "--agent-dir" ||
				arg === "--artifact-dir" ||
				arg === "--cache-state") &&
			index + 1 >= argv.length
		) {
			throw new Error(`Missing value for ${arg}`);
		}

		if (arg === "--mode") {
			options.mode = parseMode(argv[++index]);
			continue;
		}

		if (arg === "--runs") {
			options.runs = parseIntegerFlag(argv[++index], "--runs");
			continue;
		}

		if (arg === "--warmup") {
			options.warmup = parseIntegerFlag(argv[++index], "--warmup");
			continue;
		}

		if (arg === "--profile-dir") {
			options.profileDir = resolve(argv[++index]);
			continue;
		}

		if (arg === "--label") {
			options.label = argv[++index];
			continue;
		}

		if (arg === "--runtime") {
			options.runtime = parseRuntime(argv[++index]);
			continue;
		}

		if (arg === "--agent-dir") {
			options.agentDir = resolve(argv[++index]);
			continue;
		}

		if (arg === "--artifact-dir") {
			options.artifactDir = resolve(argv[++index]);
			continue;
		}

		if (arg === "--cache-state") {
			const cacheState = argv[++index];
			if (cacheState !== "uncontrolled" && cacheState !== "cold" && cacheState !== "warm") {
				throw new Error(`Invalid --cache-state: ${cacheState}`);
			}
			options.cacheState = cacheState;
			continue;
		}

		throw new Error(`Unknown option: ${arg}`);
	}

	return options;
}

function detectRuntimeFromPackageManager() {
	const userAgent = process.env.npm_config_user_agent ?? "";
	return userAgent.startsWith("bun/") ? "bun" : "node";
}

function resolveRuntime(requestedRuntime) {
	if (requestedRuntime === "auto") {
		return detectRuntimeFromPackageManager();
	}
	return requestedRuntime;
}

function resolveProfileDir(runtime, requestedProfileDir) {
	if (requestedProfileDir) {
		return requestedProfileDir;
	}
	return runtime === "bun" ? defaultBunProfileDir : defaultNodeProfileDir;
}

function resolveLabel(mode, requestedLabel) {
	return requestedLabel ?? `${mode}-startup`;
}

function formatMs(value) {
	return `${value.toFixed(1)}ms`;
}

function readSourceIdentity() {
	const packageMetadata = JSON.parse(readFileSync(join(packageDir, "package.json"), "utf8"));
	let commit = "unknown";
	let workingTree = "unknown";
	let dirtyFingerprint;
	try {
		commit = execFileSync("git", ["rev-parse", "HEAD"], { cwd: repoRoot, encoding: "utf8" }).trim();
		const status = execFileSync("git", ["status", "--porcelain=v1", "-z", "--untracked-files=all"], {
			cwd: repoRoot,
			encoding: "utf8",
		});
		workingTree = status.length === 0 ? "clean" : "dirty";
		if (status.length > 0) dirtyFingerprint = createHash("sha256").update(status).digest("hex");
	} catch {
		// A packaged profiler may run without repository metadata.
	}
	return {
		commit,
		workingTree,
		...(dirtyFingerprint ? { dirtyFingerprint } : {}),
		packageName: packageMetadata.name,
		packageVersion: packageMetadata.version,
	};
}

function resolveRuntimeVersion(runtime) {
	if (runtime === "node") {
		return process.versions.node;
	}
	try {
		return execFileSync("bun", ["--version"], { encoding: "utf8" }).trim();
	} catch {
		return "unknown";
	}
}

function writeBenchmarkArtifact({ artifactDir, options, result, runIndex, measuredIndex, runtime, sourceIdentity }) {
	const kind = measuredIndex === undefined ? "warmup" : "measured";
	const kindIndex = measuredIndex ?? runIndex + 1;
	const artifact = createStartupArtifact({
		source: sourceIdentity,
		runtime: { name: runtime, version: resolveRuntimeVersion(runtime) },
		platform: { name: platform(), architecture: arch(), release: release() },
		benchmark: {
			label: options.label,
			mode: options.mode,
			lifecycleEndpoint: options.mode === "rpc" ? "rpc-get-state" : "tui-input-echo",
			agentState: options.isolatedAgentDir ? "isolated" : options.agentDir ? "configured-explicit" : "configured-default",
			cacheState: options.cacheState,
			offline: options.offline,
			cpuProfile: options.cpuProfile,
		},
		run: {
			kind,
			index: kindIndex,
			sequence: runIndex + 1,
			startedAt: result.startedAt,
			elapsedMs: result.elapsedMs,
			...(result.processElapsedMs === undefined ? {} : { processElapsedMs: result.processElapsedMs }),
			profileFile: result.profilePath ? basename(result.profilePath) : null,
		},
		milestones: result.milestones,
		timingGroups: result.timingGroups,
	});

	const safeLabel = options.label.replaceAll(/[^a-zA-Z0-9._-]+/g, "-").replaceAll(/^-+|-+$/g, "") || "startup";
	const artifactPath = join(artifactDir, `${safeLabel}-${kind}-${String(kindIndex).padStart(3, "0")}.json`);
	writeFileSync(artifactPath, `${JSON.stringify(artifact, null, 2)}\n`, "utf8");
	return artifactPath;
}

function toDisplayPath(path) {
	const relativePath = relative(repoRoot, path);
	if (relativePath !== "" && !relativePath.startsWith("..")) {
		return relativePath.replaceAll("\\", "/");
	}
	return path;
}

function summarize(values) {
	const sorted = [...values].sort((a, b) => a - b);
	const total = sorted.reduce((sum, value) => sum + value, 0);
	const middle = Math.floor(sorted.length / 2);
	const median = sorted.length % 2 === 0 ? (sorted[middle - 1] + sorted[middle]) / 2 : sorted[middle];
	return {
		min: sorted[0],
		max: sorted[sorted.length - 1],
		avg: total / sorted.length,
		median,
	};
}

function summarizeTimingMaps(runs) {
	const valuesByLabel = new Map();
	for (const run of runs) {
		for (const [label, value] of run.timings.entries()) {
			const values = valuesByLabel.get(label);
			if (values) {
				values.push(value);
			} else {
				valuesByLabel.set(label, [value]);
			}
		}
	}

	const summaries = new Map();
	for (const [label, values] of valuesByLabel.entries()) {
		summaries.set(label, summarize(values));
	}
	return summaries;
}

function toMetricName(label) {
	return `${label.replaceAll(/[^a-zA-Z0-9]+/g, "_").replaceAll(/^_+|_+$/g, "")}_ms`;
}

async function waitForExit(child, errorPrefix) {
	return await new Promise((resolve, reject) => {
		child.once("error", reject);
		child.once("exit", (code, signal) => {
			if (signal) {
				reject(new Error(`${errorPrefix} exited from signal ${signal}`));
				return;
			}
			resolve(code ?? 0);
		});
	});
}

async function runBuild() {
	process.stdout.write("Building packages/tui, packages/ai, packages/agent, and packages/coding-agent...\n");
	const startedAt = performance.now();
	const child = spawn(
		"npm",
		[
			"run",
			"build",
			"--workspace",
			"packages/tui",
			"--workspace",
			"packages/ai",
			"--workspace",
			"packages/agent",
			"--workspace",
			"packages/coding-agent",
		],
		{
			cwd: repoRoot,
			env: process.env,
			stdio: ["ignore", "pipe", "pipe"],
			shell: process.platform === "win32",
		},
	);

	let stdout = "";
	let stderr = "";
	child.stdout.setEncoding("utf8");
	child.stdout.on("data", (chunk) => {
		stdout += chunk;
	});
	child.stderr.setEncoding("utf8");
	child.stderr.on("data", (chunk) => {
		stderr += chunk;
	});

	const exitCode = await waitForExit(child, "Build");
	if (exitCode !== 0) {
		if (stdout.trim()) {
			process.stdout.write(`${stdout}${stdout.endsWith("\n") ? "" : "\n"}`);
		}
		if (stderr.trim()) {
			process.stderr.write(`${stderr}${stderr.endsWith("\n") ? "" : "\n"}`);
		}
		throw new Error(`Build failed with exit code ${exitCode}`);
	}

	process.stdout.write(`Build completed in ${formatMs(performance.now() - startedAt)}\n`);
}

function getRuntimeCommand(runtime, mode, profileDir, profileName, cpuProfile) {
	const benchmarkArgs = ["--no-session"];
	if (mode === "rpc") {
		benchmarkArgs.push("--mode", "rpc");
	}

	if (runtime === "bun") {
		const args = [];
		if (cpuProfile) {
			args.push("--cpu-prof", `--cpu-prof-dir=${profileDir}`, `--cpu-prof-name=${profileName}`);
		}
		args.push(srcCliPath, ...benchmarkArgs);
		return {
			executable: "bun",
			args,
		};
	}

	const args = [];
	if (cpuProfile) {
		args.push("--cpu-prof", `--cpu-prof-dir=${profileDir}`, `--cpu-prof-name=${profileName}`);
	}
	args.push(distCliPath, ...benchmarkArgs);
	return {
		executable: process.execPath,
		args,
	};
}

function createBenchmarkEnv(options, isolatedAgentDir, startupInput) {
	const env = { ...process.env };
	if (options.agentDir) {
		env[agentDirEnvName] = options.agentDir;
	} else if (isolatedAgentDir) {
		env[agentDirEnvName] = isolatedAgentDir;
	}
	env.PI_STARTUP_PROBE = "1";
	env.PI_TIMING = "1";
	if (startupInput) {
		env.PI_STARTUP_BENCHMARK_INPUT = startupInput;
	} else {
		delete env.PI_STARTUP_BENCHMARK_INPUT;
	}
	if (options.mode === "tui") {
		env[startupBenchmarkEnvName] = "1";
	}
	if (options.offline) {
		env.PI_OFFLINE = "1";
		env.PI_SKIP_VERSION_CHECK = "1";
	}
	return env;
}

async function runTuiBenchmarkRun({ runtime, runIndex, measuredIndex, options, profileDir }) {
	const runNumber = runIndex + 1;
	const suffix = String(runNumber).padStart(3, "0");
	const profileName = `${options.label}-${suffix}.cpuprofile`;
	const tempRoot = options.isolatedAgentDir ? mkdtempSync(join(tmpdir(), "pi-startup-benchmark-")) : undefined;
	const isolatedAgentDir = tempRoot ? join(tempRoot, "agent") : undefined;
	if (isolatedAgentDir) {
		mkdirSync(isolatedAgentDir, { recursive: true });
	}

	const command = getRuntimeCommand(runtime, "tui", profileDir, profileName, options.cpuProfile);
	const startupInput = `__RECODE_STARTUP_ECHO_${runNumber}__`;
	const child = spawn(command.executable, command.args, {
		cwd: packageDir,
		env: createBenchmarkEnv(options, isolatedAgentDir, startupInput),
		stdio: ["pipe", "ignore", "pipe"],
		shell: process.platform === "win32" && runtime === "bun",
	});

	let stderr = "";
	let inputSent = false;
	child.stderr.setEncoding("utf8");
	child.stderr.on("data", (chunk) => {
		stderr += chunk;
		if (!inputSent && parseStartupMilestones(stderr).some((milestone) => milestone.name === "tui-input-ready")) {
			inputSent = true;
			child.stdin.end(startupInput);
		}
	});

	const startedAt = new Date().toISOString();
	const startedAtPerformance = performance.now();
	const exitCode = await waitForExit(child, `Benchmark ${measuredIndex === undefined ? `warmup ${runNumber}` : `run ${measuredIndex}`}`);
	const elapsedMs = performance.now() - startedAtPerformance;

	try {
		if (exitCode !== 0) {
			throw new Error(stderr.trim() || `Benchmark child exited with code ${exitCode}`);
		}

		const profilePath = options.cpuProfile ? join(profileDir, profileName) : undefined;
		if (profilePath && !existsSync(profilePath)) {
			throw new Error(`CPU profile was not written: ${profilePath}`);
		}

		const milestones = parseStartupMilestones(stderr);
		const targetMilestone = milestones.find((milestone) => milestone.name === "tui-input-echo");
		if (!targetMilestone) {
			throw new Error("TUI benchmark did not emit the tui-input-echo milestone");
		}
		const timingGroups = redactTimingGroups(parseStartupTimings(stderr), repoRoot);
		return {
			elapsedMs: targetMilestone.elapsedMs,
			processElapsedMs: elapsedMs,
			profilePath,
			startedAt,
			milestones,
			timingGroups,
			timings: flattenStartupTimings(timingGroups),
		};
	} finally {
		if (tempRoot) {
			rmSync(tempRoot, { recursive: true, force: true });
		}
	}
}

function splitJsonLines(buffer, onLine) {
	let remaining = buffer;
	while (true) {
		const newlineIndex = remaining.indexOf("\n");
		if (newlineIndex === -1) {
			return remaining;
		}
		const line = remaining.slice(0, newlineIndex);
		onLine(line.endsWith("\r") ? line.slice(0, -1) : line);
		remaining = remaining.slice(newlineIndex + 1);
	}
}

async function runRpcBenchmarkRun({ runtime, runIndex, measuredIndex, options, profileDir }) {
	const runNumber = runIndex + 1;
	const suffix = String(runNumber).padStart(3, "0");
	const profileName = `${options.label}-${suffix}.cpuprofile`;
	const tempRoot = options.isolatedAgentDir ? mkdtempSync(join(tmpdir(), "pi-startup-benchmark-")) : undefined;
	const isolatedAgentDir = tempRoot ? join(tempRoot, "agent") : undefined;
	if (isolatedAgentDir) {
		mkdirSync(isolatedAgentDir, { recursive: true });
	}

	const command = getRuntimeCommand(runtime, "rpc", profileDir, profileName, options.cpuProfile);
	const child = spawn(command.executable, command.args, {
		cwd: packageDir,
		env: createBenchmarkEnv(options, isolatedAgentDir),
		stdio: ["pipe", "pipe", "pipe"],
		shell: process.platform === "win32" && runtime === "bun",
	});

	let stdoutBuffer = "";
	let stderr = "";
	let readyElapsedMs;
	let responseError;
	const requestId = `startup-benchmark-${runNumber}`;
	const startedAt = new Date().toISOString();
	const startedAtPerformance = performance.now();

	child.stdout.setEncoding("utf8");
	child.stdout.on("data", (chunk) => {
		stdoutBuffer = splitJsonLines(stdoutBuffer + chunk, (line) => {
			if (line.trim() === "") {
				return;
			}
			let parsed;
			try {
				parsed = JSON.parse(line);
			} catch (error) {
				responseError = error instanceof Error ? error.message : String(error);
				return;
			}

			if (parsed?.type !== "response" || parsed.id !== requestId || parsed.command !== "get_state") {
				return;
			}

			if (parsed.success !== true) {
				responseError = typeof parsed.error === "string" ? parsed.error : "get_state failed";
				return;
			}

			if (readyElapsedMs === undefined) {
				readyElapsedMs = performance.now() - startedAtPerformance;
				child.stdin.end();
			}
		});
	});

	child.stderr.setEncoding("utf8");
	child.stderr.on("data", (chunk) => {
		stderr += chunk;
	});

	child.stdin.setDefaultEncoding("utf8");
	child.stdin.write(`${JSON.stringify({ id: requestId, type: "get_state" })}\n`);

	const exitCode = await waitForExit(child, `Benchmark ${measuredIndex === undefined ? `warmup ${runNumber}` : `run ${measuredIndex}`}`);

	try {
		if (responseError) {
			throw new Error(responseError);
		}
		if (readyElapsedMs === undefined) {
			throw new Error(stderr.trim() || "RPC benchmark did not receive get_state response");
		}
		if (exitCode !== 0) {
			throw new Error(stderr.trim() || `Benchmark child exited with code ${exitCode}`);
		}

		const profilePath = options.cpuProfile ? join(profileDir, profileName) : undefined;
		if (profilePath && !existsSync(profilePath)) {
			throw new Error(`CPU profile was not written: ${profilePath}`);
		}

		const timingGroups = redactTimingGroups(parseStartupTimings(stderr), repoRoot);
		return {
			elapsedMs: readyElapsedMs,
			profilePath,
			startedAt,
			milestones: parseStartupMilestones(stderr),
			timingGroups,
			timings: flattenStartupTimings(timingGroups),
		};
	} finally {
		if (tempRoot) {
			rmSync(tempRoot, { recursive: true, force: true });
		}
	}
}

async function runBenchmarkRun(params) {
	if (params.options.mode === "rpc") {
		return await runRpcBenchmarkRun(params);
	}
	return await runTuiBenchmarkRun(params);
}

async function main() {
	const options = parseArgs(process.argv.slice(2));
	if (options.help) {
		printHelp();
		return;
	}

	if (options.agentDir && options.isolatedAgentDir) {
		throw new Error("--agent-dir and --isolated-agent-dir cannot be combined");
	}

	const runtime = resolveRuntime(options.runtime);
	options.label = resolveLabel(options.mode, options.label);
	const profileDir = resolveProfileDir(runtime, options.profileDir);

	if (runtime === "node" && options.build) {
		await runBuild();
	}
	if (runtime === "bun") {
		process.stdout.write(
			`Using Bun runtime with ${options.mode === "rpc" ? "packages/coding-agent/src/cli.ts --mode rpc" : "packages/coding-agent/src/cli.ts"}\n`,
		);
	}

	const entryPath = runtime === "bun" ? srcCliPath : distCliPath;
	if (!existsSync(entryPath)) {
		throw new Error(`CLI entrypoint not found: ${entryPath}`);
	}

	mkdirSync(profileDir, { recursive: true });
	if (options.artifactDir) {
		mkdirSync(options.artifactDir, { recursive: true });
	}
	const sourceIdentity = readSourceIdentity();

	const measuredRuns = [];
	const totalRuns = options.warmup + options.runs;
	for (let runIndex = 0; runIndex < totalRuns; runIndex++) {
		const measuredIndex = runIndex >= options.warmup ? runIndex - options.warmup + 1 : undefined;
		const result = await runBenchmarkRun({
			runtime,
			runIndex,
			measuredIndex,
			options,
			profileDir,
		});

		process.stdout.write(
			`[${measuredIndex === undefined ? `warmup ${runIndex + 1}` : `run ${measuredIndex}`}] elapsed=${formatMs(result.elapsedMs)}\n`,
		);
		if (options.artifactDir) {
			const artifactPath = writeBenchmarkArtifact({
				artifactDir: options.artifactDir,
				options,
				result,
				runIndex,
				measuredIndex,
				runtime,
				sourceIdentity,
			});
			process.stdout.write(`  artifact=${toDisplayPath(artifactPath)}\n`);
		}

		if (measuredIndex !== undefined) {
			measuredRuns.push(result);
		}
	}

	if (measuredRuns.length === 0) {
		process.stdout.write("\nNo measured runs requested.\n");
		return;
	}

	const elapsedSummary = summarize(measuredRuns.map((run) => run.elapsedMs));
	const timingSummaries = summarizeTimingMaps(measuredRuns);
	const maxElapsedRun = measuredRuns.reduce((slowest, run) => (run.elapsedMs > slowest.elapsedMs ? run : slowest));
	if (measuredRuns.length === 1) {
		process.stdout.write("\nResult\n");
		process.stdout.write(`  runtime:          ${runtime}\n`);
		process.stdout.write(`  mode:             ${options.mode}\n`);
		process.stdout.write(`  elapsed:          ${formatMs(measuredRuns[0].elapsedMs)}\n`);
		for (const [label, summary] of timingSummaries.entries()) {
			process.stdout.write(`  ${label}: ${formatMs(summary.median)}\n`);
		}
		if (options.cpuProfile && maxElapsedRun.profilePath) {
			process.stdout.write(`  selected profile: ${toDisplayPath(maxElapsedRun.profilePath)}\n`);
			process.stdout.write(`  profiles dir:     ${toDisplayPath(profileDir)}\n`);
		}
		process.stdout.write(`METRIC startup_time_ms=${measuredRuns[0].elapsedMs.toFixed(1)}\n`);
		for (const [label, summary] of timingSummaries.entries()) {
			process.stdout.write(`METRIC ${toMetricName(label)}=${summary.median.toFixed(1)}\n`);
		}
		return;
	}

	process.stdout.write("\nSummary\n");
	process.stdout.write(`  runtime:          ${runtime}\n`);
	process.stdout.write(`  mode:             ${options.mode}\n`);
	process.stdout.write(`  elapsed min:      ${formatMs(elapsedSummary.min)}\n`);
	process.stdout.write(`  elapsed median:   ${formatMs(elapsedSummary.median)}\n`);
	process.stdout.write(`  elapsed avg:      ${formatMs(elapsedSummary.avg)}\n`);
	process.stdout.write(`  elapsed max:      ${formatMs(elapsedSummary.max)}\n`);
	for (const [label, summary] of timingSummaries.entries()) {
		process.stdout.write(`  ${label} median: ${formatMs(summary.median)}\n`);
	}
	if (options.cpuProfile && maxElapsedRun.profilePath) {
		process.stdout.write(`  selected profile: ${toDisplayPath(maxElapsedRun.profilePath)}\n`);
		process.stdout.write(`  profiles dir:     ${toDisplayPath(profileDir)}\n`);
	}
	process.stdout.write(`METRIC startup_time_ms=${elapsedSummary.median.toFixed(1)}\n`);
	for (const [label, summary] of timingSummaries.entries()) {
		process.stdout.write(`METRIC ${toMetricName(label)}=${summary.median.toFixed(1)}\n`);
	}
}

main().catch((error) => {
	const message = error instanceof Error ? error.message : String(error);
	console.error(message);
	process.exit(1);
});
