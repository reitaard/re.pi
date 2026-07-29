import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import { createReleaseManifest } from "./generate-release-manifest.mjs";
import { RELEASE_REPOSITORY_ROOT } from "./release-identity.mjs";

const commit = "a".repeat(40);
const packageVersion = JSON.parse(readFileSync(join(RELEASE_REPOSITORY_ROOT, "packages/ai/package.json"), "utf8")).version;

test("creates deterministic development provenance without putting the commit in SemVer", () => {
	const identity = { branch: "agent-harness", commit, mode: "branch", tag: undefined, version: packageVersion };
	const first = createReleaseManifest(identity);
	const second = createReleaseManifest(identity);

	assert.deepEqual(first, second);
	assert.equal(first.displayName, "Recode");
	assert.equal(first.release.version, packageVersion);
	assert.equal(first.release.channel, "development");
	assert.equal(first.source.commit, commit);
	assert.equal(first.release.version.includes(commit.slice(0, 8)), false);
	const { manifestSha256, ...unsignedManifest } = first;
	assert.equal(manifestSha256, createHash("sha256").update(JSON.stringify(unsignedManifest)).digest("hex"));
});

test("binds a stable manifest to its exact release tag and supported artifact set", () => {
	const manifest = createReleaseManifest({
		branch: undefined,
		commit,
		mode: "tag",
		tag: `v${packageVersion}`,
		version: packageVersion,
	});

	assert.deepEqual(manifest.release, { channel: "stable", tag: `v${packageVersion}`, version: packageVersion });
	assert.deepEqual(
		manifest.supportedArtifacts.filter((artifact) => artifact.kind === "binary").map((artifact) => artifact.filename),
		[
			"recode-windows-x64.zip",
			"recode-windows-arm64.zip",
			"recode-linux-x64.tar.gz",
			"recode-linux-arm64.tar.gz",
		],
	);
	assert.equal(manifest.packages.every((pkg) => pkg.version === packageVersion), true);
});
