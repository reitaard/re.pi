#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import { readFileSync, realpathSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const RELEASE_IDENTITY_POLICY = Object.freeze({
	authoritativeBranch: "agent-harness",
	customBaseCommit: "c5ab200bc43993d211e1e97baa0c9abd27c0ce79",
	productName: "RePi",
	appName: "recode",
	rootPackageName: "repi-monorepo",
	packages: Object.freeze([
		Object.freeze({ directory: "packages/ai", name: "@reitaard/repi-ai" }),
		Object.freeze({ directory: "packages/agent", name: "@reitaard/repi-agent-core" }),
		Object.freeze({ directory: "packages/tui", name: "@reitaard/repi-tui" }),
		Object.freeze({ directory: "packages/orchestrator", name: "@reitaard/repi-orchestrator" }),
		Object.freeze({ directory: "packages/coding-agent", name: "@reitaard/repi-coding-agent" }),
	]),
});

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
export const RELEASE_REPOSITORY_ROOT = resolve(scriptDirectory, "..");
const TAG_PATTERN = /^v(\d+\.\d+\.\d+)$/;

function readJson(path) {
	return JSON.parse(readFileSync(path, "utf8"));
}

function git(root, args, options = {}) {
	try {
		return execFileSync("git", args, {
			cwd: root,
			encoding: "utf8",
			stdio: ["ignore", "pipe", options.silentError ? "ignore" : "pipe"],
		}).trim();
	} catch (error) {
		if (options.optional) return undefined;
		const detail = error instanceof Error ? error.message : String(error);
		throw new Error(`Release identity Git check failed: git ${args.join(" ")}\n${detail}`);
	}
}

function samePath(left, right) {
	const normalizedLeft = realpathSync(left).replaceAll("\\", "/");
	const normalizedRight = realpathSync(right).replaceAll("\\", "/");
	return process.platform === "win32"
		? normalizedLeft.toLowerCase() === normalizedRight.toLowerCase()
		: normalizedLeft === normalizedRight;
}

export function validateReleaseIdentitySnapshot(snapshot, options = {}) {
	const policy = options.policy ?? RELEASE_IDENTITY_POLICY;
	const mode = options.mode ?? "branch";
	const expectedTag = options.expectedTag;
	const errors = [];

	if (mode !== "branch" && mode !== "tag") errors.push(`unsupported identity mode ${mode}`);
	if (!snapshot.repositoryRootMatches) errors.push("checkout root does not match the authoritative repository root");
	if (snapshot.rootPackageName !== policy.rootPackageName) {
		errors.push(`root package is ${snapshot.rootPackageName ?? "missing"}; expected ${policy.rootPackageName}`);
	}
	if (snapshot.product?.productName !== policy.productName) {
		errors.push(`product name is ${snapshot.product?.productName ?? "missing"}; expected ${policy.productName}`);
	}
	if (snapshot.product?.appName !== policy.appName) {
		errors.push(`application name is ${snapshot.product?.appName ?? "missing"}; expected ${policy.appName}`);
	}
	if (snapshot.product?.packageName !== policy.packages.at(-1).name) {
		errors.push(`product package is ${snapshot.product?.packageName ?? "missing"}; expected ${policy.packages.at(-1).name}`);
	}
	if (!snapshot.baseIsAncestor) errors.push(`HEAD is not descended from custom baseline ${policy.customBaseCommit}`);
	if (snapshot.dirty) errors.push("checkout has uncommitted or untracked files");

	const versions = new Set();
	for (const expectedPackage of policy.packages) {
		const actualPackage = snapshot.packages.find((pkg) => pkg.directory === expectedPackage.directory);
		if (!actualPackage) {
			errors.push(`missing publishable package ${expectedPackage.directory}`);
			continue;
		}
		if (actualPackage.name !== expectedPackage.name) {
			errors.push(`${expectedPackage.directory} is ${actualPackage.name}; expected ${expectedPackage.name}`);
		}
		versions.add(actualPackage.version);
	}
	if (versions.size !== 1) errors.push(`publishable packages are not lockstep versioned: ${[...versions].join(", ")}`);
	const version = versions.size === 1 ? [...versions][0] : undefined;

	if (mode === "branch") {
		if (snapshot.branch !== policy.authoritativeBranch) {
			errors.push(`current branch is ${snapshot.branch ?? "detached"}; expected ${policy.authoritativeBranch}`);
		}
	}

	if (mode === "tag") {
		const match = expectedTag?.match(TAG_PATTERN);
		if (!match) {
			errors.push(`release tag ${expectedTag ?? "missing"} must match vX.Y.Z`);
		} else if (version !== match[1]) {
			errors.push(`release tag ${expectedTag} does not match package version ${version ?? "unknown"}`);
		}
		if (snapshot.product?.nextStableVersion !== version) {
			errors.push(
				`release version ${version ?? "unknown"} does not match declared next stable version ${snapshot.product?.nextStableVersion ?? "missing"}`,
			);
		}
		if (!snapshot.tagCommit) errors.push(`release tag ${expectedTag ?? "missing"} does not resolve to a commit`);
		else if (snapshot.tagCommit !== snapshot.head) errors.push(`release tag ${expectedTag} does not point to HEAD ${snapshot.head}`);
	}

	if (errors.length > 0) throw new Error(`Release identity verification failed:\n- ${errors.join("\n- ")}`);
	return Object.freeze({
		branch: snapshot.branch,
		commit: snapshot.head,
		mode,
		tag: mode === "tag" ? expectedTag : undefined,
		version,
	});
}

export function assertReleaseIdentity(options = {}) {
	const root = resolve(options.root ?? RELEASE_REPOSITORY_ROOT);
	const mode = options.mode ?? "branch";
	const expectedTag = options.expectedTag;
	const policy = options.policy ?? RELEASE_IDENTITY_POLICY;
	const gitRoot = git(root, ["rev-parse", "--show-toplevel"]);
	const head = git(root, ["rev-parse", "HEAD"]);
	const branch = git(root, ["symbolic-ref", "--quiet", "--short", "HEAD"], { optional: true, silentError: true });
	const dirty = Boolean(git(root, ["status", "--porcelain=v1", "--untracked-files=normal"]));
	const baseIsAncestor =
		git(root, ["merge-base", "--is-ancestor", policy.customBaseCommit, "HEAD"], {
			optional: true,
			silentError: true,
		}) !== undefined;
	const packages = policy.packages.map((pkg) => {
		const packageJson = readJson(join(root, pkg.directory, "package.json"));
		return { directory: pkg.directory, name: packageJson.name, version: packageJson.version };
	});
	const snapshot = {
		baseIsAncestor,
		branch,
		dirty,
		head,
		packages,
		product: readJson(join(root, "repi", "product.json")),
		repositoryRootMatches: samePath(root, gitRoot),
		rootPackageName: readJson(join(root, "package.json")).name,
		tagCommit:
			mode === "tag" && expectedTag?.match(TAG_PATTERN)
				? git(root, ["rev-parse", `refs/tags/${expectedTag}^{commit}`], { optional: true, silentError: true })
				: undefined,
	};
	return validateReleaseIdentitySnapshot(snapshot, { expectedTag, mode, policy });
}

function parseCliArgs(args) {
	let mode = "branch";
	let expectedTag;
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
		throw new Error(`Unknown option: ${arg}`);
	}
	return { expectedTag, mode };
}

const entryPath = process.argv[1] ? resolve(process.argv[1]) : undefined;
if (entryPath === fileURLToPath(import.meta.url)) {
	try {
		const report = assertReleaseIdentity(parseCliArgs(process.argv.slice(2)));
		console.log(
			`Verified Recode release identity: ${report.version} ${report.commit}${report.tag ? ` ${report.tag}` : ` ${report.branch}`}`,
		);
	} catch (error) {
		console.error(error instanceof Error ? error.message : String(error));
		process.exit(1);
	}
}
