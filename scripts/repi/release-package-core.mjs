const UPSTREAM_RUNTIME_PACKAGES = [
	"@earendil-works/pi-agent-core",
	"@earendil-works/pi-ai",
	"@earendil-works/pi-tui",
];

export function createRepiPackageManifest(sourceManifest, buildInfo, options = {}) {
	if (!sourceManifest || typeof sourceManifest !== "object") throw new Error("Source package manifest is required");
	for (const key of ["packageName", "version", "appName", "configDir", "productName", "upstreamVersion", "releaseTag", "sourceCommit"]) {
		if (typeof buildInfo?.[key] !== "string" || !buildInfo[key].trim()) {
			throw new Error(`Invalid RePi build info: ${key} is missing`);
		}
	}
	if (!Number.isInteger(buildInfo.revision) || buildInfo.revision < 1) {
		throw new Error("Invalid RePi build info: revision must be a positive integer");
	}

	const files = Array.isArray(sourceManifest.files)
		? sourceManifest.files.filter((entry) => entry !== "npm-shrinkwrap.json")
		: ["dist", "docs", "examples", "CHANGELOG.md"];
	const note = typeof options.note === "string" && options.note.trim() ? options.note.trim() : undefined;
	const dependencies = { ...(sourceManifest.dependencies ?? {}) };
	for (const packageName of UPSTREAM_RUNTIME_PACKAGES) {
		if (packageName in dependencies) dependencies[packageName] = buildInfo.upstreamVersion;
	}

	return {
		...sourceManifest,
		name: buildInfo.packageName,
		version: buildInfo.version,
		description: "Recode: the RePi downstream coding agent",
		piConfig: {
			...(sourceManifest.piConfig ?? {}),
			name: buildInfo.appName,
			configDir: buildInfo.configDir,
		},
		bin: {
			[buildInfo.appName]: "dist/recode-cli.js",
		},
		files,
		scripts: {},
		dependencies,
		publishConfig: {
			access: "public",
		},
		repository: {
			type: "git",
			url: "git+https://github.com/reitaard/re.pi.git",
			directory: "packages/coding-agent",
		},
		homepage: "https://github.com/reitaard/re.pi",
		bugs: {
			url: "https://github.com/reitaard/re.pi/issues",
		},
		repi: {
			schemaVersion: 1,
			productName: buildInfo.productName,
			channel: buildInfo.release ? "stable" : "development",
			upstreamVersion: buildInfo.upstreamVersion,
			upstreamTag: buildInfo.upstreamTag,
			upstreamCommit: buildInfo.upstreamCommit,
			sourceCommit: buildInfo.sourceCommit,
			revision: buildInfo.revision,
			releaseTag: buildInfo.releaseTag,
			...(note ? { note } : {}),
		},
	};
}
