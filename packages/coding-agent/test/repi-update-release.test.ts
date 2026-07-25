import { afterEach, describe, expect, it, vi } from "vitest";
import { checkForRepiUpdate, getLatestRepiRelease, isNewerRepiVersion } from "../src/repi/update/release.ts";

const PACKAGE_NAME = "@reitaard/repi-coding-agent";

afterEach(() => {
	vi.unstubAllGlobals();
	delete process.env.PI_SKIP_REPI_VERSION_CHECK;
});

function registryResponse(version: string, overrides: Record<string, unknown> = {}): Response {
	return new Response(
		JSON.stringify({
			"dist-tags": { latest: version },
			versions: {
				[version]: {
					name: PACKAGE_NAME,
					version,
					repi: {
						productName: "RePi",
						channel: "stable",
						upstreamVersion: "0.82.1",
						revision: 1,
						releaseTag: "repi-v0.82.1-r1",
						note: "Provider and Kioku update.",
					},
					...overrides,
				},
			},
		}),
	);
}

describe("RePi npm release channel", () => {
	it("loads a validated stable RePi package from the npm registry", async () => {
		const fetchMock = vi.fn(async () => registryResponse("0.82.1-repi.1"));
		const release = await getLatestRepiRelease({
			packageName: PACKAGE_NAME,
			registryUrl: "https://registry.example.test/",
			fetchImpl: fetchMock,
		});

		expect(fetchMock).toHaveBeenCalledWith(
			"https://registry.example.test/%40reitaard%2Frepi-coding-agent",
			expect.objectContaining({ signal: expect.any(AbortSignal) }),
		);
		expect(release).toEqual({
			packageName: PACKAGE_NAME,
			version: "0.82.1-repi.1",
			installSpec: `${PACKAGE_NAME}@0.82.1-repi.1`,
			upstreamVersion: "0.82.1",
			revision: 1,
			releaseTag: "repi-v0.82.1-r1",
			note: "Provider and Kioku update.",
		});
	});

	it("rejects packages without coherent stable RePi provenance", async () => {
		const wrongProduct = vi.fn(async () =>
			registryResponse("0.82.1-repi.1", { repi: { productName: "Pi", channel: "stable" } }),
		);
		await expect(
			getLatestRepiRelease({ packageName: PACKAGE_NAME, fetchImpl: wrongProduct }),
		).resolves.toBeUndefined();

		const wrongRevision = vi.fn(async () =>
			registryResponse("0.82.1-repi.1", {
				repi: {
					productName: "RePi",
					channel: "stable",
					upstreamVersion: "0.82.1",
					revision: 2,
					releaseTag: "repi-v0.82.1-r2",
				},
			}),
		);
		await expect(
			getLatestRepiRelease({ packageName: PACKAGE_NAME, fetchImpl: wrongRevision }),
		).resolves.toBeUndefined();
	});

	it("orders tagged releases above development builds and by revision", async () => {
		expect(isNewerRepiVersion("0.82.1-repi.1", "0.82.1-repi.1.dev.30.8bcb9316")).toBe(true);
		expect(isNewerRepiVersion("0.82.1-repi.1", "0.82.1-repi.1")).toBe(false);
		expect(isNewerRepiVersion("0.82.1-repi.2", "0.82.1-repi.1")).toBe(true);
		expect(isNewerRepiVersion("0.82.1-repi.1", "0.82.1-repi.2.dev.1.abcdef12")).toBe(false);
		expect(isNewerRepiVersion("0.83.0-repi.1", "0.82.1-repi.9")).toBe(true);

		const fetchMock = vi.fn(async () => registryResponse("0.82.1-repi.1"));
		await expect(
			checkForRepiUpdate("0.82.1-repi.1.dev.30.8bcb9316", {
				packageName: PACKAGE_NAME,
				fetchImpl: fetchMock,
			}),
		).resolves.toMatchObject({ version: "0.82.1-repi.1" });
	});
});
