import assert from "node:assert/strict";
import test from "node:test";
import { formatRepiVersion, normalizeUpstreamTag, revisionFromTag } from "./repi/version-core.mjs";

const config = {
	releaseTagPrefix: "repi-v",
	revisionMarker: "-r",
};

test("normalizes an upstream semver tag", () => {
	assert.equal(normalizeUpstreamTag("v7.8.9"), "7.8.9");
});

test("rejects non-upstream tags", () => {
	assert.throws(() => normalizeUpstreamTag("repi-v7.8.9-r1"), /Unsupported upstream tag/);
});

test("extracts only matching RePi revisions", () => {
	assert.equal(revisionFromTag("repi-v7.8.9-r3", "7.8.9", config), 3);
	assert.equal(revisionFromTag("repi-v7.8.8-r3", "7.8.9", config), undefined);
	assert.equal(revisionFromTag("repi-v7.8.9-r0", "7.8.9", config), undefined);
});

test("formats release and development versions", () => {
	assert.equal(
		formatRepiVersion({ upstreamVersion: "7.8.9", revision: 2, release: true }),
		"7.8.9-repi.2",
	);
	assert.equal(
		formatRepiVersion({
			upstreamVersion: "7.8.9",
			revision: 3,
			release: false,
			distance: 14,
			shortSha: "a1b2c3d4",
			dirty: true,
		}),
		"7.8.9-repi.3.dev.14.a1b2c3d4.dirty",
	);
});
