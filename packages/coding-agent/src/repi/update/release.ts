import { compare, gt, valid } from "semver";

const DEFAULT_REGISTRY_URL = "https://registry.npmjs.org";
const DEFAULT_DIST_TAG = "latest";
const DEFAULT_TIMEOUT_MS = 5000;

export interface RepiRelease {
	packageName: string;
	version: string;
	installSpec: string;
	upstreamVersion: string;
	revision: number;
	releaseTag: string;
	note?: string;
}

export interface RepiReleaseLookupOptions {
	packageName?: string;
	registryUrl?: string;
	distTag?: string;
	timeoutMs?: number;
	fetchImpl?: typeof fetch;
}

interface ParsedRepiVersion {
	upstreamVersion: string;
	revision: number;
	development: boolean;
	distance: number;
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null;
}

function normalizeRegistryUrl(value: string): string {
	return value.trim().replace(/\/+$/, "");
}

function configuredPackageName(options: RepiReleaseLookupOptions): string {
	const packageName = options.packageName ?? process.env.REPI_PACKAGE_NAME;
	if (!packageName?.trim()) throw new Error("RePi update package is not configured");
	return packageName.trim();
}

function configuredRegistryUrl(options: RepiReleaseLookupOptions): string {
	return normalizeRegistryUrl(
		options.registryUrl ?? process.env.REPI_UPDATE_REGISTRY ?? process.env.npm_config_registry ?? DEFAULT_REGISTRY_URL,
	);
}

function configuredDistTag(options: RepiReleaseLookupOptions): string {
	return (options.distTag ?? process.env.REPI_UPDATE_DIST_TAG ?? DEFAULT_DIST_TAG).trim() || DEFAULT_DIST_TAG;
}

function parseRepiVersion(value: string): ParsedRepiVersion | undefined {
	const match = /^(.*)-repi\.(\d+)(?:\.dev\.(\d+)\.[0-9A-Za-z-]+(?:\.dirty)?)?$/.exec(value.trim());
	if (!match) return undefined;
	const upstreamVersion = match[1];
	const revision = Number(match[2]);
	const distance = match[3] === undefined ? 0 : Number(match[3]);
	if (!valid(upstreamVersion) || !Number.isInteger(revision) || revision < 1 || !Number.isInteger(distance)) {
		return undefined;
	}
	return {
		upstreamVersion,
		revision,
		development: match[3] !== undefined,
		distance,
	};
}

export function isNewerRepiVersion(candidateVersion: string, currentVersion: string): boolean {
	const candidateRepi = parseRepiVersion(candidateVersion);
	const currentRepi = parseRepiVersion(currentVersion);
	if (candidateRepi && currentRepi) {
		const upstreamComparison = compare(candidateRepi.upstreamVersion, currentRepi.upstreamVersion);
		if (upstreamComparison !== 0) return upstreamComparison > 0;
		if (candidateRepi.revision !== currentRepi.revision) {
			return candidateRepi.revision > currentRepi.revision;
		}
		if (candidateRepi.development !== currentRepi.development) {
			return !candidateRepi.development;
		}
		if (candidateRepi.development && candidateRepi.distance !== currentRepi.distance) {
			return candidateRepi.distance > currentRepi.distance;
		}
		return false;
	}

	const candidate = valid(candidateVersion.trim());
	const current = valid(currentVersion.trim());
	if (!candidate || !current) return candidateVersion.trim() !== currentVersion.trim();
	return gt(candidate, current);
}

export async function getLatestRepiRelease(options: RepiReleaseLookupOptions = {}): Promise<RepiRelease | undefined> {
	if (process.env.PI_OFFLINE) return undefined;

	const packageName = configuredPackageName(options);
	const registryUrl = configuredRegistryUrl(options);
	const distTag = configuredDistTag(options);
	const fetchImpl = options.fetchImpl ?? fetch;
	const response = await fetchImpl(`${registryUrl}/${encodeURIComponent(packageName)}`, {
		headers: { accept: "application/json" },
		signal: AbortSignal.timeout(options.timeoutMs ?? DEFAULT_TIMEOUT_MS),
	});
	if (!response.ok) return undefined;

	const payload: unknown = await response.json();
	if (!isRecord(payload) || !isRecord(payload["dist-tags"]) || !isRecord(payload.versions)) return undefined;
	const version = payload["dist-tags"][distTag];
	if (typeof version !== "string" || !valid(version)) return undefined;
	const manifest = payload.versions[version];
	if (!isRecord(manifest) || manifest.name !== packageName || manifest.version !== version) return undefined;

	const repi = manifest.repi;
	if (!isRecord(repi) || repi.productName !== "RePi" || repi.channel !== "stable") return undefined;
	const upstreamVersion = typeof repi.upstreamVersion === "string" ? repi.upstreamVersion : undefined;
	const revision = typeof repi.revision === "number" && Number.isInteger(repi.revision) ? repi.revision : undefined;
	const releaseTag = typeof repi.releaseTag === "string" ? repi.releaseTag : undefined;
	if (!upstreamVersion || !valid(upstreamVersion) || revision === undefined || revision < 1 || !releaseTag) {
		return undefined;
	}
	if (version !== `${upstreamVersion}-repi.${revision}`) return undefined;
	if (releaseTag !== `repi-v${upstreamVersion}-r${revision}`) return undefined;
	const note = typeof repi.note === "string" && repi.note.trim() ? repi.note.trim() : undefined;

	return {
		packageName,
		version,
		installSpec: `${packageName}@${version}`,
		upstreamVersion,
		revision,
		releaseTag,
		...(note ? { note } : {}),
	};
}

export async function checkForRepiUpdate(
	currentVersion = process.env.REPI_VERSION ?? "0.0.0",
	options: RepiReleaseLookupOptions = {},
): Promise<RepiRelease | undefined> {
	if (process.env.PI_SKIP_REPI_VERSION_CHECK) return undefined;
	try {
		const release = await getLatestRepiRelease(options);
		return release && isNewerRepiVersion(release.version, currentVersion) ? release : undefined;
	} catch {
		return undefined;
	}
}
