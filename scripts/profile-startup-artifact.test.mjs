import assert from "node:assert/strict";
import test from "node:test";
import {
	createStartupArtifact,
	flattenStartupTimings,
	parseStartupMilestones,
	parseStartupTimings,
	redactTimingGroups,
} from "./profile-startup-artifact.mjs";

test("parses every named startup timing group without colliding totals", () => {
	const groups = parseStartupTimings(`noise

--- Startup Timings: main ---
  parseArgs: 15ms
  TOTAL: 40305ms
-----------------------------

--- Startup Timings: extensions ---
  C:\\Users\\creator\\.pi\\agent\\npm\\node_modules\\pi-mcp-adapter\\index.ts module import: 20762ms
  TOTAL: 40030ms
-----------------------------------
`);

	assert.deepEqual(groups, [
		{
			namespace: "main",
			timings: [
				{ label: "parseArgs", ms: 15 },
				{ label: "TOTAL", ms: 40305 },
			],
		},
		{
			namespace: "extensions",
			timings: [
				{
					label: "C:\\Users\\creator\\.pi\\agent\\npm\\node_modules\\pi-mcp-adapter\\index.ts module import",
					ms: 20762,
				},
				{ label: "TOTAL", ms: 40030 },
			],
		},
	]);

	assert.deepEqual(Object.fromEntries(flattenStartupTimings(groups)), {
		"main.parseArgs": 15,
		"main.TOTAL": 40305,
		"extensions.C:\\Users\\creator\\.pi\\agent\\npm\\node_modules\\pi-mcp-adapter\\index.ts module import": 20762,
		"extensions.TOTAL": 40030,
	});
});

test("parses valid startup milestones and ignores malformed diagnostics", () => {
	assert.deepEqual(
		parseStartupMilestones(`noise
RECODE_STARTUP_MILESTONE {"schemaVersion":1,"name":"session-ready","elapsedMs":42.5}
RECODE_STARTUP_MILESTONE not-json
RECODE_STARTUP_MILESTONE {"schemaVersion":2,"name":"ignored","elapsedMs":1}
`),
		[{ schemaVersion: 1, name: "session-ready", elapsedMs: 42.5 }],
	);
});

test("retains legacy unnamed groups and decimal measurements", () => {
	assert.deepEqual(
		parseStartupTimings(`--- Startup Timings ---\n  phase: 1.5ms\n------------------------\n`),
		[{ namespace: "default", timings: [{ label: "phase", ms: 1.5 }] }],
	);
});

test("creates a versioned artifact with sorted package identities", () => {
	const artifact = createStartupArtifact({
		source: { commit: "abc", packageName: "recode", packageVersion: "1.0.0" },
		runtime: { name: "node", version: "26.5.0" },
		platform: { name: "win32", architecture: "x64", release: "test" },
		benchmark: { mode: "rpc", cacheState: "uncontrolled" },
		run: { kind: "measured", index: 1, elapsedMs: 10 },
		milestones: [
			{
				schemaVersion: 1,
				name: "session-ready",
				elapsedMs: 8,
				details: {
					sourceOnlyPackages: 2,
					verifiedPackages: 1,
					rejectedPackages: 0,
					readyPackages: 1,
					pendingPackages: 2,
				},
			},
		],
		timingGroups: [
			{
				namespace: "extensions",
				timings: [
					{ label: "<package:z-package>/index.js module import", ms: 4 },
					{ label: "<package:a-package>/index.js module import", ms: 3 },
				],
			},
		],
	});

	assert.equal(artifact.schemaVersion, 1);
	assert.deepEqual(artifact.loadedPackages, ["a-package", "z-package"]);
	assert.deepEqual(artifact.packageRuntime, {
		sourceOnlyPackages: 2,
		verifiedPackages: 1,
		rejectedPackages: 0,
		readyPackages: 1,
		pendingPackages: 2,
	});
	assert.equal(artifact.milestones[0].name, "session-ready");
	assert.equal(artifact.timingGroups[0].namespace, "extensions");
});

test("redacts creator paths while retaining package identity", () => {
	const redacted = redactTimingGroups(
		[
			{
				namespace: "extensions",
				timings: [
					{
						label: "C:\\Users\\creator\\.pi\\agent\\npm\\node_modules\\pi-mcp-adapter\\index.ts module import",
						ms: 20,
					},
					{ label: "C:\\Users\\creator\\private-extension.ts factory", ms: 5 },
				],
			},
		],
		"C:\\repo",
	);

	assert.deepEqual(redacted, [
		{
			namespace: "extensions",
			timings: [
				{ label: "<package:pi-mcp-adapter>/index.ts module import", ms: 20 },
				{ label: "<external>/private-extension.ts factory", ms: 5 },
			],
		},
	]);
});
