import { basename, relative } from "node:path";

const timingHeaderPattern = /^--- Startup Timings(?::\s*(.+?))? ---$/;
const timingFooterPattern = /^-{4,}$/;
const timingEntryPattern = /^\s+(.+):\s+(\d+(?:\.\d+)?)ms$/;
const startupMilestonePrefix = "RECODE_STARTUP_MILESTONE ";

export function parseStartupTimings(stderr) {
	const groups = [];
	let currentGroup;

	for (const line of stderr.split(/\r?\n/)) {
		const trimmed = line.trim();
		const headerMatch = trimmed.match(timingHeaderPattern);
		if (headerMatch) {
			currentGroup = {
				namespace: headerMatch[1]?.trim() || "default",
				timings: [],
			};
			groups.push(currentGroup);
			continue;
		}

		if (!currentGroup) {
			continue;
		}
		if (timingFooterPattern.test(trimmed)) {
			currentGroup = undefined;
			continue;
		}

		const timingMatch = line.match(timingEntryPattern);
		if (timingMatch) {
			currentGroup.timings.push({ label: timingMatch[1], ms: Number.parseFloat(timingMatch[2]) });
		}
	}

	return groups;
}

export function parseStartupMilestones(stderr) {
	const milestones = [];
	for (const line of stderr.split(/\r?\n/)) {
		if (!line.startsWith(startupMilestonePrefix)) {
			continue;
		}
		try {
			const milestone = JSON.parse(line.slice(startupMilestonePrefix.length));
			if (
				milestone?.schemaVersion === 1 &&
				typeof milestone.name === "string" &&
				typeof milestone.elapsedMs === "number" &&
				Number.isFinite(milestone.elapsedMs)
			) {
				milestones.push(milestone);
			}
		} catch {
			// Ignore malformed diagnostic lines instead of invalidating the benchmark run.
		}
	}
	return milestones;
}

export function flattenStartupTimings(groups) {
	const timings = new Map();
	for (const group of groups) {
		for (const timing of group.timings) {
			timings.set(`${group.namespace}.${timing.label}`, timing.ms);
		}
	}
	return timings;
}

export function redactTimingGroups(groups, repoRoot) {
	return groups.map((group) => ({
		namespace: group.namespace,
		timings: group.timings.map((timing) => ({
			label: redactTimingLabel(timing.label, repoRoot),
			ms: timing.ms,
		})),
	}));
}

export function createStartupArtifact({ source, runtime, platform, benchmark, run, milestones, timingGroups }) {
	const packageNames = new Set();
	for (const group of timingGroups) {
		for (const timing of group.timings) {
			const packageMatch = timing.label.match(/^<package:([^>]+)>/);
			if (packageMatch) {
				packageNames.add(packageMatch[1]);
			}
		}
	}

	const runtimeDetails = milestones.find((milestone) => milestone.name === "session-ready")?.details;
	const packageRuntime =
		typeof runtimeDetails?.sourceOnlyPackages === "number" &&
		typeof runtimeDetails.verifiedPackages === "number" &&
		typeof runtimeDetails.rejectedPackages === "number" &&
		typeof runtimeDetails.readyPackages === "number" &&
		typeof runtimeDetails.pendingPackages === "number"
			? {
				sourceOnlyPackages: runtimeDetails.sourceOnlyPackages,
				verifiedPackages: runtimeDetails.verifiedPackages,
				rejectedPackages: runtimeDetails.rejectedPackages,
				readyPackages: runtimeDetails.readyPackages,
				pendingPackages: runtimeDetails.pendingPackages,
			}
			: undefined;

	return {
		schemaVersion: 1,
		source,
		runtime,
		platform,
		benchmark,
		run,
		milestones,
		loadedPackages: [...packageNames].sort(),
		...(packageRuntime ? { packageRuntime } : {}),
		timingGroups,
	};
}

function redactTimingLabel(label, repoRoot) {
	const suffixMatch = label.match(/^(.*?)( (?:module import|factory))$/);
	const candidatePath = suffixMatch?.[1] ?? label;
	const suffix = suffixMatch?.[2] ?? "";
	const normalizedPath = candidatePath.replaceAll("\\", "/");
	const nodeModulesMatch = normalizedPath.match(/(?:^|\/)node_modules\/((?:@[^/]+\/)?[^/]+)(\/.*)?$/);
	if (nodeModulesMatch) {
		return `<package:${nodeModulesMatch[1]}>${nodeModulesMatch[2] ?? ""}${suffix}`;
	}

	const repoRelativePath = relative(repoRoot, candidatePath);
	if (repoRelativePath !== "" && !repoRelativePath.startsWith("..") && !repoRelativePath.startsWith("/")) {
		return `${repoRelativePath.replaceAll("\\", "/")}${suffix}`;
	}

	if (/^(?:[a-zA-Z]:[\\/]|\/)/.test(candidatePath)) {
		return `<external>/${basename(candidatePath)}${suffix}`;
	}
	return label;
}
