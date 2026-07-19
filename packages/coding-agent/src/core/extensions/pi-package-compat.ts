const PI_PACKAGE_PREFIXES = ["@earendil-works", "@mariozechner"] as const;

const ROOT_ALIASES = new Map<string, string>([
	["pi-ai", "@reitaard/repi-ai/compat"],
	["pi-agent-core", "@reitaard/repi-agent-core"],
	["pi-coding-agent", "@reitaard/repi-coding-agent"],
	["pi-tui", "@reitaard/repi-tui"],
]);

const TARGET_PREFIXES = new Map<string, string>([
	["pi-ai", "@reitaard/repi-ai"],
	["pi-agent-core", "@reitaard/repi-agent-core"],
	["pi-coding-agent", "@reitaard/repi-coding-agent"],
	["pi-tui", "@reitaard/repi-tui"],
]);

const INSTALL_MARKER = Symbol.for("recode.pi-package-compat-hooks");

type CompatibilityGlobal = typeof globalThis & {
	[INSTALL_MARKER]?: boolean;
};

/**
 * Map upstream Pi package scopes onto the Recode runtime.
 *
 * The pi-ai root intentionally maps to the compat entrypoint because third-party
 * extensions still use the historical global stream()/complete() API. Explicit
 * subpaths preserve their suffix, so pi-ai/oauth and future public subpaths route
 * to the equivalent Recode export.
 */
export function mapPiPackageSpecifier(specifier: string): string {
	for (const scope of PI_PACKAGE_PREFIXES) {
		const prefix = `${scope}/`;
		if (!specifier.startsWith(prefix)) continue;

		const remainder = specifier.slice(prefix.length);
		const slashIndex = remainder.indexOf("/");
		const packageName = slashIndex === -1 ? remainder : remainder.slice(0, slashIndex);
		const subpath = slashIndex === -1 ? "" : remainder.slice(slashIndex + 1);
		const targetRoot = TARGET_PREFIXES.get(packageName);
		if (!targetRoot) return specifier;
		if (!subpath) return ROOT_ALIASES.get(packageName) ?? targetRoot;
		return `${targetRoot}/${subpath}`;
	}
	return specifier;
}

/**
 * Install synchronous Node module-resolution hooks before Recode imports its
 * application graph. The hooks affect ESM import(), require(), and createRequire(),
 * which covers jiti-loaded TypeScript extensions.
 *
 * Bun uses the extension loader's virtual-module path instead and does not install
 * Node hooks here.
 */
export async function installPiPackageCompatibilityHooks(): Promise<void> {
	if ((process.versions as NodeJS.ProcessVersions & { bun?: string }).bun) return;

	const compatibilityGlobal = globalThis as CompatibilityGlobal;
	if (compatibilityGlobal[INSTALL_MARKER]) return;
	compatibilityGlobal[INSTALL_MARKER] = true;

	try {
		const { registerHooks } = await import("node:module");
		registerHooks({
			resolve(specifier, context, nextResolve) {
				return nextResolve(mapPiPackageSpecifier(specifier), context);
			},
		});
	} catch (error) {
		delete compatibilityGlobal[INSTALL_MARKER];
		throw error;
	}
}
