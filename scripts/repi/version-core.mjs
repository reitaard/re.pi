import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

export function readProductConfig(rootDir = process.cwd()) {
	const path = resolve(rootDir, "repi/product.json");
	const config = JSON.parse(readFileSync(path, "utf8"));
	for (const key of [
		"productName",
		"appName",
		"appTitle",
		"packageName",
		"configDir",
		"environmentPrefix",
		"upstreamTagPattern",
		"releaseTagPrefix",
		"revisionMarker",
	]) {
		if (typeof config[key] !== "string" || !config[key].trim()) {
			throw new Error(`Invalid RePi product config: ${key} must be a non-empty string`);
		}
	}
	return config;
}

export function normalizeUpstreamTag(tag) {
	const match = /^v(\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?)$/.exec(tag.trim());
	if (!match) throw new Error(`Unsupported upstream tag: ${tag}`);
	return match[1];
}

export function revisionFromTag(tag, upstreamVersion, config) {
	const prefix = `${config.releaseTagPrefix}${upstreamVersion}${config.revisionMarker}`;
	if (!tag.startsWith(prefix)) return undefined;
	const revision = Number(tag.slice(prefix.length));
	return Number.isInteger(revision) && revision > 0 ? revision : undefined;
}

export function formatRepiVersion({ upstreamVersion, revision, release, distance = 0, shortSha = "unknown", dirty = false }) {
	const base = `${upstreamVersion}-repi.${revision}`;
	if (release) return base;
	return `${base}.dev.${distance}.${shortSha}${dirty ? ".dirty" : ""}`;
}

function runGit(rootDir, args, allowFailure = false) {
	try {
		return execFileSync("git", args, { cwd: rootDir, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
	} catch (error) {
		if (allowFailure) return "";
		const detail = error?.stderr?.toString().trim() || error?.message || String(error);
		throw new Error(`git ${args.join(" ")} failed: ${detail}`);
	}
}

export function deriveRepiBuildInfo(rootDir = process.cwd()) {
	const config = readProductConfig(rootDir);
	const upstreamTag = runGit(rootDir, [
		"describe",
		"--tags",
		"--match",
		config.upstreamTagPattern,
		"--abbrev=0",
		"--first-parent",
		"HEAD",
	]);
	const upstreamVersion = normalizeUpstreamTag(upstreamTag);
	const tagPattern = `${config.releaseTagPrefix}${upstreamVersion}${config.revisionMarker}*`;
	const allReleaseTags = runGit(rootDir, ["tag", "--list", tagPattern], true)
		.split(/\r?\n/)
		.map((tag) => tag.trim())
		.filter(Boolean);
	const exactReleaseTags = runGit(rootDir, ["tag", "--points-at", "HEAD", "--list", tagPattern], true)
		.split(/\r?\n/)
		.map((tag) => tag.trim())
		.filter(Boolean);
	const allRevisions = allReleaseTags
		.map((tag) => revisionFromTag(tag, upstreamVersion, config))
		.filter((revision) => revision !== undefined);
	const exactRevisions = exactReleaseTags
		.map((tag) => revisionFromTag(tag, upstreamVersion, config))
		.filter((revision) => revision !== undefined);
	const release = exactRevisions.length > 0;
	const revision = release ? Math.max(...exactRevisions) : Math.max(0, ...allRevisions) + 1;
	const sourceCommit = runGit(rootDir, ["rev-parse", "HEAD"]);
	const shortSha = runGit(rootDir, ["rev-parse", "--short=8", "HEAD"]);
	const upstreamCommit = runGit(rootDir, ["rev-list", "-n", "1", upstreamTag]);
	const distance = Number(runGit(rootDir, ["rev-list", "--count", `${upstreamTag}..HEAD`])) || 0;
	const dirty = Boolean(runGit(rootDir, ["status", "--porcelain", "--untracked-files=no"], true));
	const version = formatRepiVersion({ upstreamVersion, revision, release, distance, shortSha, dirty });
	const releaseTag = `${config.releaseTagPrefix}${upstreamVersion}${config.revisionMarker}${revision}`;

	return {
		schemaVersion: 1,
		productName: config.productName,
		appName: config.appName,
		appTitle: config.appTitle,
		packageName: config.packageName,
		configDir: config.configDir,
		environmentPrefix: config.environmentPrefix,
		version,
		upstreamVersion,
		upstreamTag,
		upstreamCommit,
		sourceCommit,
		revision,
		release,
		releaseTag,
		distance,
		dirty,
	};
}
