import { execFileSync, spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { arch, platform, release, tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { performance } from "node:perf_hooks";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const outputPath = process.argv[2] ? resolve(process.argv[2]) : undefined;
const runtimeDir = mkdtempSync(join(tmpdir(), "recode-maestro-benchmark-"));
process.env.PI_ORCHESTRATOR_DIR = runtimeDir;

const { sendIpcRequest } = await import("../packages/orchestrator/src/ipc/client.ts");
const { IpcMaestroDashboardClient } = await import("../packages/orchestrator/src/dashboard-client.ts");

function readSourceIdentity() {
	const commit = execFileSync("git", ["rev-parse", "HEAD"], { cwd: repoRoot, encoding: "utf8" }).trim();
	const status = execFileSync("git", ["status", "--porcelain=v1", "-z", "--untracked-files=all"], {
		cwd: repoRoot,
		encoding: "utf8",
	});
	return {
		commit,
		workingTree: status.length === 0 ? "clean" : "dirty",
		...(status.length > 0 ? { dirtyFingerprint: createHash("sha256").update(status).digest("hex") } : {}),
	};
}

function percentile(values, ratio) {
	const sorted = [...values].sort((left, right) => left - right);
	return sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * ratio))];
}

async function waitForReady(timeoutMs = 30_000) {
	const deadline = performance.now() + timeoutMs;
	let lastError;
	while (performance.now() < deadline) {
		try {
			const response = await sendIpcRequest({ type: "health" }, { timeoutMs: 1_000 });
			if (response.type === "health_result" && response.ok && response.health?.ready) return response.health;
		} catch (error) {
			lastError = error;
		}
		await new Promise((resolvePromise) => setTimeout(resolvePromise, 25));
	}
	throw lastError instanceof Error ? lastError : new Error("Maestro did not become ready");
}

async function stopInstance(instanceId) {
	const response = await sendIpcRequest({ type: "stop", instanceId });
	if (response.type !== "stop_result" || !response.ok) throw new Error(response.error ?? "stop failed");
}

const serviceStarted = performance.now();
const service = spawn(process.execPath, [join(repoRoot, "packages/orchestrator/src/cli.ts"), "service", "run", "--supervision", "manual"], {
	cwd: repoRoot,
	env: { ...process.env, PI_ORCHESTRATOR_DIR: runtimeDir },
	stdio: ["ignore", "pipe", "pipe"],
	windowsHide: true,
});
let serviceStderr = "";
service.stderr.setEncoding("utf8");
service.stderr.on("data", (chunk) => {
	serviceStderr += chunk;
});

const ownedInstances = [];
try {
	const health = await waitForReady();
	const serviceColdStartMs = performance.now() - serviceStarted;
	const controlSamples = [];
	for (let index = 0; index < 10; index++) {
		const started = performance.now();
		const response = await sendIpcRequest({ type: "list" });
		if (response.type !== "list_result" || !response.ok) throw new Error(response.error ?? "list failed");
		controlSamples.push(performance.now() - started);
	}

	const spawnStarted = performance.now();
	const spawned = await sendIpcRequest({
		type: "spawn",
		cwd: repoRoot,
		workspaceAccess: "read-only",
		label: "v2-c-one-session",
	});
	if (spawned.type !== "spawn_result" || !spawned.ok || !spawned.instance) {
		throw new Error(spawned.error ?? "spawn failed");
	}
	ownedInstances.push(spawned.instance.id);
	const oneSessionSpawnMs = performance.now() - spawnStarted;

	const dashboardClient = new IpcMaestroDashboardClient();
	const attachStarted = performance.now();
	const attachment = await dashboardClient.attach(
		spawned.instance.id,
		() => {},
		() => {},
		() => {},
		() => {},
	);
	const warmAttachMs = performance.now() - attachStarted;
	attachment.close();
	await stopInstance(spawned.instance.id);
	ownedInstances.length = 0;

	let capacityFailure;
	for (let index = 0; index < 10; index++) {
		const response = await sendIpcRequest({
			type: "spawn",
			cwd: repoRoot,
			workspaceAccess: "read-only",
			label: `v2-c-capacity-${index + 1}`,
		});
		if (response.type !== "spawn_result" || !response.ok || !response.instance) {
			capacityFailure = { requested: index + 1, error: response.error ?? "spawn failed" };
			break;
		}
		ownedInstances.push(response.instance.id);
	}

	const artifact = {
		schemaVersion: 1,
		source: readSourceIdentity(),
		runtime: { node: process.versions.node, platform: platform(), architecture: arch(), release: release() },
		endpoint: {
			serviceColdStartMs,
			warmControlMedianMs: percentile(controlSamples, 0.5),
			warmControlP90Ms: percentile(controlSamples, 0.9),
			oneSessionSpawnMs,
			warmAttachMs,
		},
		capacity: {
			requestedSessions: 10,
			admittedSessions: ownedInstances.length,
			failure: capacityFailure,
		},
		health: { state: health.state, supervisionMode: health.supervisionMode },
		notes: [
			"No provider/model request was made.",
			"This is an uncontrolled-cache run, not a destructive cold-cache measurement.",
		],
	};
	const serialized = `${JSON.stringify(artifact, null, 2)}\n`;
	if (outputPath) {
		mkdirSync(dirname(outputPath), { recursive: true });
		writeFileSync(outputPath, serialized, "utf8");
	}
	process.stdout.write(serialized);
} finally {
	for (const instanceId of ownedInstances.reverse()) {
		try {
			await stopInstance(instanceId);
		} catch {
			// The isolated service shutdown below remains the final containment boundary.
		}
	}
	try {
		await sendIpcRequest({ type: "shutdown", reason: "planned-stop" }, { timeoutMs: 30_000 });
	} catch {
		service.kill();
	}
	await new Promise((resolvePromise) => service.once("exit", resolvePromise));
	rmSync(runtimeDir, { recursive: true, force: true });
	if (service.exitCode !== 0 && serviceStderr.trim()) process.stderr.write(serviceStderr);
}
