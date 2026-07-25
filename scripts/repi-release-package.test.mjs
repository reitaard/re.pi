import assert from "node:assert/strict";
import test from "node:test";
import { createRepiPackageManifest } from "./repi/release-package-core.mjs";

const source = {
	name: "@earendil-works/pi-coding-agent",
	version: "0.82.1",
	piConfig: { configDir: ".pi" },
	bin: { pi: "dist/cli.js", recode: "dist/recode-cli.js" },
	files: ["dist", "docs", "npm-shrinkwrap.json"],
	scripts: { prepublishOnly: "dangerous source publish script" },
	dependencies: {
		"@earendil-works/pi-agent-core": "^0.82.1",
		"@earendil-works/pi-ai": "^0.82.1",
		"@earendil-works/pi-tui": "^0.82.1",
		chalk: "5.6.2",
	},
};

const buildInfo = {
	productName: "RePi",
	appName: "recode",
	packageName: "@reitaard/repi-coding-agent",
	configDir: ".pi",
	version: "0.82.1-repi.1",
	upstreamVersion: "0.82.1",
	upstreamTag: "v0.82.1",
	upstreamCommit: "upstream-commit",
	sourceCommit: "source-commit",
	revision: 1,
	release: true,
	releaseTag: "repi-v0.82.1-r1",
};

test("builds an isolated Recode publish manifest", () => {
	const manifest = createRepiPackageManifest(source, buildInfo, { note: "Stable RePi release." });
	assert.equal(manifest.name, "@reitaard/repi-coding-agent");
	assert.equal(manifest.version, "0.82.1-repi.1");
	assert.deepEqual(manifest.bin, { recode: "dist/recode-cli.js" });
	assert.deepEqual(manifest.piConfig, { configDir: ".pi", name: "recode" });
	assert.deepEqual(manifest.scripts, {});
	assert.deepEqual(manifest.files, ["dist", "docs"]);
	assert.equal(manifest.dependencies["@earendil-works/pi-agent-core"], "0.82.1");
	assert.equal(manifest.dependencies["@earendil-works/pi-ai"], "0.82.1");
	assert.equal(manifest.dependencies["@earendil-works/pi-tui"], "0.82.1");
	assert.equal(manifest.dependencies.chalk, "5.6.2");
	assert.deepEqual(manifest.repi, {
		schemaVersion: 1,
		productName: "RePi",
		channel: "stable",
		upstreamVersion: "0.82.1",
		upstreamTag: "v0.82.1",
		upstreamCommit: "upstream-commit",
		sourceCommit: "source-commit",
		revision: 1,
		releaseTag: "repi-v0.82.1-r1",
		note: "Stable RePi release.",
	});
});

test("marks untagged artifacts as development packages", () => {
	const manifest = createRepiPackageManifest(source, {
		...buildInfo,
		version: "0.82.1-repi.1.dev.5.abcdef12",
		release: false,
	});
	assert.equal(manifest.repi.channel, "development");
});
