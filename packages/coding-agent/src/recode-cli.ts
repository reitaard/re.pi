#!/usr/bin/env node
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

interface RepiBuildInfo {
	productName: string;
	appName: string;
	appTitle: string;
	packageName: string;
	configDir: string;
	environmentPrefix: string;
	version: string;
	upstreamVersion: string;
	upstreamTag: string;
	upstreamCommit: string;
	sourceCommit: string;
	revision: number;
	release: boolean;
	releaseTag: string;
	distance: number;
	dirty: boolean;
}

function loadBuildInfo(): RepiBuildInfo {
	const moduleDir = dirname(fileURLToPath(import.meta.url));
	const path = process.env.REPI_BUILD_INFO_PATH || join(moduleDir, "repi-build-info.json");
	if (!existsSync(path)) {
		throw new Error(`RePi build metadata is missing at ${path}. Rebuild packages/coding-agent before running recode.`);
	}
	const info = JSON.parse(readFileSync(path, "utf8")) as Partial<RepiBuildInfo>;
	for (const key of ["appName", "packageName", "version", "upstreamVersion", "releaseTag"] as const) {
		if (typeof info[key] !== "string" || !info[key]?.trim()) {
			throw new Error(`Invalid RePi build metadata: ${key} is missing`);
		}
	}
	return info as RepiBuildInfo;
}

const info = loadBuildInfo();
const args = process.argv.slice(2);

if (args.length === 1 && (args[0] === "--version" || args[0] === "-v")) {
	process.stdout.write(`${info.appName} ${info.version}\nbased on pi ${info.upstreamVersion}\n`);
	process.exit(0);
}

if (args[0] === "update") {
	const extensionsOnly = args.includes("--extensions") && !args.includes("--self") && !args.includes("--all");
	if (!extensionsOnly) {
		process.stderr.write(
			[
				"Recode self-update is protected in source builds.",
				"This command will never replace RePi with the upstream Pi package.",
				"Use the RePi release channel after a tested downstream release is published.",
				`Current candidate: ${info.version}`,
				`Upstream base: ${info.upstreamTag}`,
			].join("\n") + "\n",
		);
		process.exit(2);
	}
}

process.env.REPI_PRODUCT_NAME = info.productName;
process.env.REPI_APP_NAME = info.appName;
process.env.REPI_APP_TITLE = info.appTitle;
process.env.REPI_PACKAGE_NAME = info.packageName;
process.env.REPI_VERSION = info.version;
process.env.REPI_UPSTREAM_VERSION = info.upstreamVersion;
process.env.REPI_UPSTREAM_TAG = info.upstreamTag;
process.env.REPI_UPSTREAM_COMMIT = info.upstreamCommit;
process.env.REPI_SOURCE_COMMIT = info.sourceCommit;
process.env.REPI_RELEASE_TAG = info.releaseTag;

// Preserve the established ~/.pi and PI_* environment contract while RePi's
// visible command is named `recode`.
if (process.env.PI_CODING_AGENT_DIR && !process.env.RECODE_CODING_AGENT_DIR) {
	process.env.RECODE_CODING_AGENT_DIR = process.env.PI_CODING_AGENT_DIR;
}
if (process.env.PI_CODING_AGENT_SESSION_DIR && !process.env.RECODE_CODING_AGENT_SESSION_DIR) {
	process.env.RECODE_CODING_AGENT_SESSION_DIR = process.env.PI_CODING_AGENT_SESSION_DIR;
}

process.title = info.appName;
process.env.PI_CODING_AGENT = "true";
process.emitWarning = (() => {}) as typeof process.emitWarning;

const [{ configureHttpDispatcher }, { main }, { repiExtensionFactories }] = await Promise.all([
	import("./core/http-dispatcher.ts"),
	import("./main.ts"),
	import("./repi/extensions.ts"),
]);

// Match the upstream CLI bootstrap order while keeping RePi additions scoped to
// this entrypoint.
configureHttpDispatcher();
await main(args, { extensionFactories: repiExtensionFactories });
