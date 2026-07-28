import { performance } from "node:perf_hooks";

export const STARTUP_MILESTONE_PREFIX = "RECODE_STARTUP_MILESTONE ";

export type StartupMilestoneName =
	| "session-selected"
	| "session-ready"
	| "interactive-mode-created"
	| "tui-frame-ready"
	| "tui-input-ready"
	| "tui-input-echo"
	| "integration-ready"
	| "model-ready"
	| "prompt-accepted"
	| "provider-request"
	| "first-model-event";

const emittedMilestones = new Set<StartupMilestoneName>();
const milestoneWaiters = new Map<StartupMilestoneName, Set<() => void>>();

export function isStartupProbeEnabled(): boolean {
	return process.env.PI_STARTUP_PROBE === "1";
}

export function emitStartupMilestone(
	name: StartupMilestoneName,
	details?: Readonly<Record<string, string | number | boolean>>,
): void {
	if (!isStartupProbeEnabled() || emittedMilestones.has(name)) {
		return;
	}
	emittedMilestones.add(name);
	process.stderr.write(
		`${STARTUP_MILESTONE_PREFIX}${JSON.stringify({
			schemaVersion: 1,
			name,
			elapsedMs: Number(performance.now().toFixed(3)),
			...(details ? { details } : {}),
		})}\n`,
	);
	const waiters = milestoneWaiters.get(name);
	if (waiters) {
		milestoneWaiters.delete(name);
		for (const resolve of waiters) {
			resolve();
		}
	}
}

export async function waitForStartupMilestone(name: StartupMilestoneName, timeoutMs: number): Promise<void> {
	if (emittedMilestones.has(name)) {
		return;
	}
	await new Promise<void>((resolve, reject) => {
		const waiters = milestoneWaiters.get(name) ?? new Set<() => void>();
		milestoneWaiters.set(name, waiters);
		let timer: NodeJS.Timeout;
		const finish = (): void => {
			clearTimeout(timer);
			resolve();
		};
		waiters.add(finish);
		timer = setTimeout(() => {
			waiters.delete(finish);
			if (waiters.size === 0) {
				milestoneWaiters.delete(name);
			}
			reject(new Error(`Timed out waiting for startup milestone: ${name}`));
		}, timeoutMs);
	});
}
