#!/usr/bin/env node

import { createHash } from "node:crypto";
import { readFileSync, statSync, writeFileSync } from "node:fs";
import { basename, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export function hashFile(path) {
	return createHash("sha256").update(readFileSync(path)).digest("hex");
}

export function createArtifactIndex(releaseManifest, artifactPaths) {
	const artifacts = artifactPaths
		.map((path) => ({
			filename: basename(path),
			sha256: hashFile(path),
			size: statSync(path).size,
		}))
		.sort((left, right) => left.filename.localeCompare(right.filename));
	return {
		schemaVersion: 1,
		displayName: releaseManifest.displayName,
		release: releaseManifest.release,
		source: releaseManifest.source,
		releaseManifestSha256: releaseManifest.manifestSha256,
		artifacts,
	};
}

export function verifyArtifactIndex(releaseManifest, artifactIndex, directory) {
	const { manifestSha256, ...unsignedManifest } = releaseManifest;
	const actualManifestHash = createHash("sha256").update(JSON.stringify(unsignedManifest)).digest("hex");
	if (manifestSha256 !== actualManifestHash) throw new Error("Release manifest hash does not match its content");
	if (artifactIndex.releaseManifestSha256 !== manifestSha256) {
		throw new Error("Artifact index is not bound to the release manifest");
	}
	if (JSON.stringify(artifactIndex.release) !== JSON.stringify(releaseManifest.release)) {
		throw new Error("Artifact index release identity does not match the release manifest");
	}
	if (JSON.stringify(artifactIndex.source) !== JSON.stringify(releaseManifest.source)) {
		throw new Error("Artifact index source identity does not match the release manifest");
	}
	const indexedFilenames = artifactIndex.artifacts.map((artifact) => artifact.filename);
	if (new Set(indexedFilenames).size !== indexedFilenames.length) throw new Error("Artifact index contains duplicate filenames");
	const declaredFilenames = releaseManifest.supportedArtifacts
		.filter((artifact) => typeof artifact.filename === "string")
		.map((artifact) => artifact.filename)
		.sort();
	if (JSON.stringify([...indexedFilenames].sort()) !== JSON.stringify(declaredFilenames)) {
		throw new Error("Artifact index does not match the declared release artifact set");
	}
	for (const artifact of artifactIndex.artifacts) {
		const path = join(directory, artifact.filename);
		if (statSync(path).size !== artifact.size) throw new Error(`Artifact size mismatch: ${artifact.filename}`);
		if (hashFile(path) !== artifact.sha256) throw new Error(`Artifact SHA-256 mismatch: ${artifact.filename}`);
	}
	return true;
}

function parseArgs(args) {
	let directory;
	let manifestPath;
	let outputPath;
	const filenames = [];
	for (let index = 0; index < args.length; index++) {
		const arg = args[index];
		if (arg === "--dir") {
			directory = args[++index];
			if (!directory) throw new Error("--dir requires a directory");
			continue;
		}
		if (arg === "--manifest") {
			manifestPath = args[++index];
			if (!manifestPath) throw new Error("--manifest requires a path");
			continue;
		}
		if (arg === "--out") {
			outputPath = args[++index];
			if (!outputPath) throw new Error("--out requires a path");
			continue;
		}
		if (arg.startsWith("-")) throw new Error(`Unknown option: ${arg}`);
		filenames.push(arg);
	}
	if (!directory || !manifestPath || !outputPath || filenames.length === 0) {
		throw new Error("Usage: generate-artifact-index.mjs --dir <dir> --manifest <file> --out <file> <artifact...>");
	}
	return {
		directory: resolve(directory),
		manifestPath: resolve(manifestPath),
		outputPath: resolve(outputPath),
		filenames,
	};
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
	try {
		const options = parseArgs(process.argv.slice(2));
		const manifest = JSON.parse(readFileSync(options.manifestPath, "utf8"));
		const index = createArtifactIndex(
			manifest,
			options.filenames.map((filename) => join(options.directory, filename)),
		);
		writeFileSync(options.outputPath, `${JSON.stringify(index, null, "\t")}\n`, "utf8");
		console.log(`Wrote artifact index for ${index.artifacts.length} files to ${options.outputPath}`);
	} catch (error) {
		console.error(error instanceof Error ? error.message : String(error));
		process.exit(1);
	}
}
