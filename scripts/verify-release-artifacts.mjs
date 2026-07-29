#!/usr/bin/env node

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { verifyArtifactIndex } from "./generate-artifact-index.mjs";

function parseArgs(args) {
	let directory;
	let manifestPath;
	let indexPath;
	for (let index = 0; index < args.length; index++) {
		const arg = args[index];
		if (arg === "--dir") directory = args[++index];
		else if (arg === "--manifest") manifestPath = args[++index];
		else if (arg === "--index") indexPath = args[++index];
		else throw new Error(`Unknown option: ${arg}`);
	}
	if (!directory || !manifestPath || !indexPath) {
		throw new Error("Usage: verify-release-artifacts.mjs --dir <dir> --manifest <file> --index <file>");
	}
	return { directory: resolve(directory), indexPath: resolve(indexPath), manifestPath: resolve(manifestPath) };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
	try {
		const options = parseArgs(process.argv.slice(2));
		const releaseManifest = JSON.parse(readFileSync(options.manifestPath, "utf8"));
		const artifactIndex = JSON.parse(readFileSync(options.indexPath, "utf8"));
		verifyArtifactIndex(releaseManifest, artifactIndex, options.directory);
		console.log(`Verified ${artifactIndex.artifacts.length} Recode release artifacts`);
	} catch (error) {
		console.error(error instanceof Error ? error.message : String(error));
		process.exit(1);
	}
}
