#!/usr/bin/env node
/**
 * Release script for Recode
 *
 * Usage:
 *   node scripts/release.mjs <major|minor|patch>
 *   node scripts/release.mjs <x.y.z>
 *
 * Steps:
 * 1. Check for uncommitted changes
 * 2. Bump version via npm run version:xxx or set an explicit version
 * 3. Update CHANGELOG.md files: [Unreleased] -> [version] - date
 * 4. Regenerate release artifacts
 * 5. Run checks and tests
 * 6. Commit and tag the release
 * 7. Add new [Unreleased] section to changelogs
 * 8. Commit next-cycle changelog updates
 * 9. Push the authoritative branch and tag to trigger CI release staging
 */

import { execSync } from "child_process";
import { readFileSync, writeFileSync, readdirSync, existsSync } from "fs";
import { join } from "path";
import { assertReleaseIdentity } from "./release-identity.mjs";

const RELEASE_TARGET = process.argv[2];
const BUMP_TYPES = new Set(["major", "minor", "patch"]);
const SEMVER_RE = /^\d+\.\d+\.\d+$/;

if (!RELEASE_TARGET || (!BUMP_TYPES.has(RELEASE_TARGET) && !SEMVER_RE.test(RELEASE_TARGET))) {
	console.error("Usage: node scripts/release.mjs <major|minor|patch|x.y.z>");
	process.exit(1);
}

function run(cmd, options = {}) {
	console.log(`$ ${cmd}`);
	try {
		return execSync(cmd, { encoding: "utf-8", stdio: options.silent ? "pipe" : "inherit", ...options });
	} catch (e) {
		if (!options.ignoreError) {
			console.error(`Command failed: ${cmd}`);
			process.exit(1);
		}
		return null;
	}
}

function getVersion() {
	const pkg = JSON.parse(readFileSync("packages/ai/package.json", "utf-8"));
	return pkg.version;
}

function nextVersion(currentVersion, target) {
	if (!BUMP_TYPES.has(target)) return target;
	const parts = currentVersion.split(".").map(Number);
	if (target === "major") return `${parts[0] + 1}.0.0`;
	if (target === "minor") return `${parts[0]}.${parts[1] + 1}.0`;
	return `${parts[0]}.${parts[1]}.${parts[2] + 1}`;
}

function compareVersions(a, b) {
	const aParts = a.split(".").map(Number);
	const bParts = b.split(".").map(Number);

	for (let i = 0; i < 3; i++) {
		const diff = (aParts[i] || 0) - (bParts[i] || 0);
		if (diff !== 0) {
			return diff;
		}
	}

	return 0;
}

function shellQuote(value) {
	return `'${value.replace(/'/g, `'\\''`)}'`;
}

function stageChangedFiles() {
	const output = run("git ls-files -m -o -d --exclude-standard", { silent: true });
	const paths = [...new Set((output || "").split("\n").map((line) => line.trim()).filter(Boolean))];
	if (paths.length === 0) {
		return;
	}

	run(`git add -- ${paths.map(shellQuote).join(" ")}`);
}

function bumpOrSetVersion(target) {
	const currentVersion = getVersion();

	if (BUMP_TYPES.has(target)) {
		console.log(`Bumping version (${target})...`);
		run(`npm run version:${target}`);
		return getVersion();
	}

	if (compareVersions(target, currentVersion) <= 0) {
		console.error(`Error: explicit version ${target} must be greater than current version ${currentVersion}.`);
		process.exit(1);
	}

	console.log(`Setting explicit version (${target})...`);
	run(`npm version ${target} --workspaces --no-git-tag-version && node scripts/sync-versions.js && npm install --package-lock-only --ignore-scripts`);
	return getVersion();
}

function getChangelogs() {
	const packagesDir = "packages";
	const packages = readdirSync(packagesDir);
	return packages
		.map((pkg) => join(packagesDir, pkg, "CHANGELOG.md"))
		.filter((path) => existsSync(path));
}

function updateChangelogsForRelease(version) {
	const date = new Date().toISOString().split("T")[0];
	const changelogs = getChangelogs();

	for (const changelog of changelogs) {
		const content = readFileSync(changelog, "utf-8");

		if (!content.includes("## [Unreleased]")) {
			console.log(`  Skipping ${changelog}: no [Unreleased] section`);
			continue;
		}

		const updated = content.replace(
			"## [Unreleased]",
			`## [${version}] - ${date}`
		);
		writeFileSync(changelog, updated);
		console.log(`  Updated ${changelog}`);
	}
}

function addUnreleasedSection() {
	const changelogs = getChangelogs();
	const unreleasedSection = "## [Unreleased]\n\n";

	for (const changelog of changelogs) {
		const content = readFileSync(changelog, "utf-8");

		// Insert after "# Changelog\n\n"
		const updated = content.replace(
			/^(# Changelog\n\n)/,
			`$1${unreleasedSection}`
		);
		writeFileSync(changelog, updated);
		console.log(`  Added [Unreleased] to ${changelog}`);
	}
}

// Main flow
console.log("\n=== Release Script ===\n");

// 1. Verify the authoritative clean Recode source before any mutation.
console.log("Verifying release source identity...");
const initialIdentity = assertReleaseIdentity({ mode: "branch" });
const plannedVersion = nextVersion(getVersion(), RELEASE_TARGET);
const declaredStableVersion = JSON.parse(readFileSync("repi/product.json", "utf8")).nextStableVersion;
if (plannedVersion !== declaredStableVersion) {
	console.error(
		`Error: requested release ${plannedVersion} does not match declared next stable version ${declaredStableVersion ?? "missing"}.`,
	);
	process.exit(1);
}
const existingTag = run(`git rev-parse --verify --quiet refs/tags/v${plannedVersion}`, {
	ignoreError: true,
	silent: true,
});
if (existingTag) {
	console.error(`Error: release tag v${plannedVersion} already exists at ${existingTag.trim()}.`);
	process.exit(1);
}
console.log(`  Verified ${initialIdentity.branch} at ${initialIdentity.commit}\n`);

// 2. Bump or set version
const version = bumpOrSetVersion(RELEASE_TARGET);
console.log(`  New version: ${version}\n`);

// 3. Update changelogs
console.log("Updating CHANGELOG.md files...");
updateChangelogsForRelease(version);
console.log();

// 4. Regenerate release artifacts
console.log("Regenerating release artifacts...");
run("npm --prefix packages/ai run generate-models");
run("npm --prefix packages/ai run generate-image-models");
run("npm run shrinkwrap:coding-agent");
run("npm run install-lock:coding-agent");
console.log();

// 5. Run checks and tests
console.log("Running checks...");
run("npm run check");
console.log();

console.log("Running tests...");
run("bash ./test.sh");
console.log();

// 6. Commit and tag
console.log("Committing and tagging...");
stageChangedFiles();
run(`git commit -m "Release v${version}"`);
run(`git tag v${version}`);
const taggedIdentity = assertReleaseIdentity({ expectedTag: `v${version}`, mode: "tag" });
console.log(`  Verified tag ${taggedIdentity.tag} at ${taggedIdentity.commit}`);
console.log();

// 7. Add new [Unreleased] sections
console.log("Adding [Unreleased] sections for next cycle...");
addUnreleasedSection();
console.log();

// 8. Commit
console.log("Committing changelog updates...");
stageChangedFiles();
run(`git commit -m "Add [Unreleased] section for next cycle"`);
console.log();

// 9. Push
console.log("Pushing to remote...");
run(`git push origin ${initialIdentity.branch}`);
run(`git push origin v${version}`);
console.log();

console.log(`=== Prepared release v${version}; CI publishing starts after the tag push ===`);
