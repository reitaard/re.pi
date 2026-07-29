import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { createArtifactIndex, verifyArtifactIndex } from "./generate-artifact-index.mjs";

test("creates a deterministic sorted size and SHA-256 index bound to the release manifest", () => {
	const directory = mkdtempSync(join(tmpdir(), "recode-artifacts-"));
	try {
		const second = join(directory, "zeta.zip");
		const first = join(directory, "alpha.tar.gz");
		writeFileSync(second, "second");
		writeFileSync(first, "first");
		const unsignedManifest = {
			displayName: "Recode",
			release: { channel: "stable", tag: "v0.81.5", version: "0.81.5" },
			source: { commit: "a".repeat(40), customBaseCommit: "b".repeat(40) },
			supportedArtifacts: [
				{ filename: "alpha.tar.gz", kind: "binary" },
				{ filename: "zeta.zip", kind: "binary" },
			],
		};
		const releaseManifest = {
			...unsignedManifest,
			manifestSha256: createHash("sha256").update(JSON.stringify(unsignedManifest)).digest("hex"),
		};

		const index = createArtifactIndex(releaseManifest, [second, first]);
		assert.equal(index.releaseManifestSha256, releaseManifest.manifestSha256);
		assert.deepEqual(index.artifacts, [
			{
				filename: "alpha.tar.gz",
				sha256: createHash("sha256").update("first").digest("hex"),
				size: 5,
			},
			{
				filename: "zeta.zip",
				sha256: createHash("sha256").update("second").digest("hex"),
				size: 6,
			},
		]);
		assert.equal(verifyArtifactIndex(releaseManifest, index, directory), true);
		assert.throws(
			() => verifyArtifactIndex(releaseManifest, { ...index, artifacts: index.artifacts.slice(1) }, directory),
			/does not match the declared release artifact set/,
		);
		writeFileSync(first, "tampered");
		assert.throws(() => verifyArtifactIndex(releaseManifest, index, directory), /Artifact size mismatch: alpha\.tar\.gz/);
	} finally {
		rmSync(directory, { force: true, recursive: true });
	}
});
