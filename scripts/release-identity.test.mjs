import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { RELEASE_IDENTITY_POLICY, RELEASE_REPOSITORY_ROOT, validateReleaseIdentitySnapshot } from "./release-identity.mjs";

function validSnapshot(overrides = {}) {
	return {
		baseIsAncestor: true,
		branch: RELEASE_IDENTITY_POLICY.authoritativeBranch,
		dirty: false,
		head: "a".repeat(40),
		packages: RELEASE_IDENTITY_POLICY.packages.map((pkg) => ({
			directory: pkg.directory,
			name: pkg.name,
			version: "0.81.5",
		})),
		product: {
			appName: RELEASE_IDENTITY_POLICY.appName,
			nextStableVersion: "0.81.5",
			packageName: RELEASE_IDENTITY_POLICY.packages.at(-1).name,
			productName: RELEASE_IDENTITY_POLICY.productName,
		},
		repositoryRootMatches: true,
		rootPackageName: RELEASE_IDENTITY_POLICY.rootPackageName,
		tagCommit: undefined,
		...overrides,
	};
}

test("accepts a clean authoritative branch descended from the custom baseline", () => {
	const report = validateReleaseIdentitySnapshot(validSnapshot());
	assert.deepEqual(report, {
		branch: "agent-harness",
		commit: "a".repeat(40),
		mode: "branch",
		tag: undefined,
		version: "0.81.5",
	});
});

test("rejects dirty, detached, foreign, non-baseline branch sources", () => {
	const snapshot = validSnapshot({
		baseIsAncestor: false,
		branch: undefined,
		dirty: true,
		product: {
			appName: "pi",
			nextStableVersion: "0.81.5",
			packageName: "@earendil-works/pi-coding-agent",
			productName: "Pi",
		},
	});
	snapshot.packages[4] = { ...snapshot.packages[4], name: "@earendil-works/pi-coding-agent" };

	assert.throws(
		() => validateReleaseIdentitySnapshot(snapshot),
		(error) =>
			error instanceof Error &&
			error.message.includes("expected agent-harness") &&
			error.message.includes("uncommitted or untracked") &&
			error.message.includes("not descended from custom baseline") &&
			error.message.includes("@earendil-works/pi-coding-agent"),
	);
});

test("accepts only an exact detached release tag matching HEAD and lockstep package version", () => {
	const head = "b".repeat(40);
	const report = validateReleaseIdentitySnapshot(validSnapshot({ branch: undefined, head, tagCommit: head }), {
		expectedTag: "v0.81.5",
		mode: "tag",
	});
	assert.equal(report.tag, "v0.81.5");
	assert.equal(report.version, "0.81.5");
});

test("rejects mismatched tag versions and source commits", () => {
	assert.throws(
		() =>
			validateReleaseIdentitySnapshot(validSnapshot({ branch: undefined, tagCommit: "b".repeat(40) }), {
				expectedTag: "v0.81.6",
				mode: "tag",
			}),
		(error) =>
			error instanceof Error &&
			error.message.includes("does not match package version 0.81.5") &&
			error.message.includes("does not point to HEAD"),
	);
});

test("rejects a tag outside the declared stable release target", () => {
	const head = "b".repeat(40);
	const snapshot = validSnapshot({ head, tagCommit: head });
	snapshot.product = { ...snapshot.product, nextStableVersion: "0.81.6" };
	assert.throws(
		() => validateReleaseIdentitySnapshot(snapshot, { expectedTag: "v0.81.5", mode: "tag" }),
		/does not match declared next stable version 0\.81\.6/,
	);
});

test("rejects non-semver release labels before resolving refs", () => {
	assert.throws(
		() =>
			validateReleaseIdentitySnapshot(validSnapshot({ branch: undefined }), {
				expectedTag: "agent-harness",
				mode: "tag",
			}),
		/release tag agent-harness must match vX\.Y\.Z/,
	);
});

test("all packaging and publication entrypoints invoke the shared identity gate", () => {
	for (const path of [
		"scripts/release.mjs",
		"scripts/local-release.mjs",
		"scripts/publish.mjs",
		"scripts/recode/pack-custom-local.mjs",
		"scripts/build-binaries.sh",
		"scripts/build-termux-release.sh",
	]) {
		assert.match(readFileSync(join(RELEASE_REPOSITORY_ROOT, path), "utf8"), /release-identity|assertReleaseIdentity/);
	}
	const workflow = readFileSync(join(RELEASE_REPOSITORY_ROOT, ".github/workflows/build-binaries.yml"), "utf8");
	assert.doesNotMatch(workflow, /source_ref/);
	assert.match(workflow, /ref: \$\{\{ env\.RELEASE_TAG \}\}/);
	assert.match(workflow, /release-identity\.mjs --mode tag/);
	const binaryBuilder = readFileSync(join(RELEASE_REPOSITORY_ROOT, "scripts/build-binaries.sh"), "utf8");
	assert.match(binaryBuilder, /--skip-build is forbidden for tagged release artifacts/);
	assert.match(binaryBuilder, /tar --sort=name --mtime=@0 --owner=0 --group=0 --numeric-owner/);
	assert.match(binaryBuilder, /zip -X/);
	assert.match(readFileSync(join(RELEASE_REPOSITORY_ROOT, "scripts/publish.mjs"), "utf8"), /run\("npm", \["run", "clean"\]\)/);
	assert.match(
		readFileSync(join(RELEASE_REPOSITORY_ROOT, "scripts/recode/pack-custom-local.mjs"), "utf8"),
		/runNpm\(\["run", "clean"\]\)/,
	);
});
