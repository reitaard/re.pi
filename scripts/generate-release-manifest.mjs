#!/usr/bin/env node

import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
	assertReleaseIdentity,
	RELEASE_IDENTITY_POLICY,
	RELEASE_REPOSITORY_ROOT,
} from "./release-identity.mjs";

export const RELEASE_MANIFEST_FILENAME = "recode-release.json";

function readJson(path) {
	return JSON.parse(readFileSync(path, "utf8"));
}

export function createReleaseManifest(identity, options = {}) {
	const root = resolve(options.root ?? RELEASE_REPOSITORY_ROOT);
	const rootPackage = readJson(join(root, "package.json"));
	const packages = RELEASE_IDENTITY_POLICY.packages.map((pkg) => {
		const packageJson = readJson(join(root, pkg.directory, "package.json"));
		return { name: packageJson.name, version: packageJson.version };
	});
	const manifest = {
		schemaVersion: 1,
		displayName: "Recode",
		product: {
			name: RELEASE_IDENTITY_POLICY.productName,
			appName: RELEASE_IDENTITY_POLICY.appName,
			packageName: RELEASE_IDENTITY_POLICY.packages.at(-1).name,
		},
		release: {
			version: identity.version,
			channel: identity.mode === "tag" ? "stable" : "development",
			...(identity.tag ? { tag: identity.tag } : {}),
		},
		source: {
			commit: identity.commit,
			customBaseCommit: RELEASE_IDENTITY_POLICY.customBaseCommit,
		},
		runtime: {
			node: rootPackage.engines.node,
		},
		packages,
		supportedArtifacts: [
			{ filename: RELEASE_MANIFEST_FILENAME, kind: "manifest" },
			{ kind: "npm", name: "@reitaard/repi-coding-agent", runtime: "node" },
			{ architecture: "x64", filename: "recode-windows-x64.zip", kind: "binary", platform: "windows" },
			{ architecture: "arm64", filename: "recode-windows-arm64.zip", kind: "binary", platform: "windows" },
			{ architecture: "x64", filename: "recode-linux-x64.tar.gz", kind: "binary", platform: "linux" },
			{ architecture: "arm64", filename: "recode-linux-arm64.tar.gz", kind: "binary", platform: "linux" },
			{ filename: "recode-termux-node.tar.gz", kind: "node-archive", platform: "termux", runtime: "node" },
			{ filename: "recode-source.tar.gz", kind: "source" },
		],
	};
	const canonical = JSON.stringify(manifest);
	return {
		...manifest,
		manifestSha256: createHash("sha256").update(canonical).digest("hex"),
	};
}

export function writeReleaseManifest(manifest, outputPaths) {
	const content = `${JSON.stringify(manifest, null, "\t")}\n`;
	for (const outputPath of outputPaths) {
		mkdirSync(dirname(outputPath), { recursive: true });
		writeFileSync(outputPath, content, "utf8");
	}
}

function parseArgs(args) {
	let mode = "branch";
	let expectedTag;
	const outputPaths = [];
	for (let index = 0; index < args.length; index++) {
		const arg = args[index];
		if (arg === "--mode") {
			mode = args[++index];
			if (!mode) throw new Error("--mode requires branch or tag");
			continue;
		}
		if (arg === "--tag") {
			expectedTag = args[++index];
			if (!expectedTag) throw new Error("--tag requires vX.Y.Z");
			continue;
		}
		if (arg === "--out") {
			const outputPath = args[++index];
			if (!outputPath) throw new Error("--out requires a path");
			outputPaths.push(resolve(outputPath));
			continue;
		}
		throw new Error(`Unknown option: ${arg}`);
	}
	return { expectedTag, mode, outputPaths };
}

const entryPath = process.argv[1] ? resolve(process.argv[1]) : undefined;
if (entryPath === fileURLToPath(import.meta.url)) {
	try {
		const options = parseArgs(process.argv.slice(2));
		const identity = assertReleaseIdentity({ expectedTag: options.expectedTag, mode: options.mode });
		const manifest = createReleaseManifest(identity);
		const outputPaths =
			options.outputPaths.length > 0
				? options.outputPaths
				: RELEASE_IDENTITY_POLICY.packages
						.map((pkg) => join(RELEASE_REPOSITORY_ROOT, pkg.directory, "dist", RELEASE_MANIFEST_FILENAME))
						.filter((path) => existsSync(dirname(path)));
		if (outputPaths.length === 0) throw new Error("No release manifest output paths exist; build packages first or pass --out");
		writeReleaseManifest(manifest, outputPaths);
		console.log(`Wrote ${RELEASE_MANIFEST_FILENAME} (${manifest.manifestSha256}) to ${outputPaths.length} location(s)`);
	} catch (error) {
		console.error(error instanceof Error ? error.message : String(error));
		process.exit(1);
	}
}
