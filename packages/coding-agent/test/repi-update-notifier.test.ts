import { afterEach, describe, expect, it, vi } from "vitest";
import type { ExtensionAPI, ExtensionContext, SessionStartEvent } from "../src/core/extensions/types.ts";
import { repiUpdateNotifier } from "../src/repi/update/extension.ts";

const originalVersion = process.env.REPI_VERSION;
const originalPackageName = process.env.REPI_PACKAGE_NAME;
const originalOffline = process.env.PI_OFFLINE;

afterEach(() => {
	if (originalVersion === undefined) delete process.env.REPI_VERSION;
	else process.env.REPI_VERSION = originalVersion;
	if (originalPackageName === undefined) delete process.env.REPI_PACKAGE_NAME;
	else process.env.REPI_PACKAGE_NAME = originalPackageName;
	if (originalOffline === undefined) delete process.env.PI_OFFLINE;
	else process.env.PI_OFFLINE = originalOffline;
	vi.unstubAllGlobals();
});

describe("RePi TUI update notifier", () => {
	it("announces one newer stable release with the normal update command", async () => {
		process.env.REPI_VERSION = "0.82.1-repi.1.dev.40.abcdef12";
		process.env.REPI_PACKAGE_NAME = "@reitaard/repi-coding-agent";
		delete process.env.PI_OFFLINE;

		let sessionStart: ((event: SessionStartEvent, context: ExtensionContext) => void) | undefined;
		const pi = {
			on: (event: string, handler: typeof sessionStart) => {
				expect(event).toBe("session_start");
				sessionStart = handler;
			},
		} as unknown as ExtensionAPI;
		const notify = vi.fn();
		const fetchMock = vi.fn(async () =>
			new Response(
				JSON.stringify({
					"dist-tags": { latest: "0.82.1-repi.1" },
					versions: {
						"0.82.1-repi.1": {
							name: "@reitaard/repi-coding-agent",
							version: "0.82.1-repi.1",
							repi: {
								productName: "RePi",
								channel: "stable",
								upstreamVersion: "0.82.1",
								revision: 1,
								releaseTag: "repi-v0.82.1-r1",
							},
						},
					},
				}),
			),
		);
		vi.stubGlobal("fetch", fetchMock);

		await repiUpdateNotifier(pi);
		sessionStart?.(
			{ type: "session_start", reason: "startup" },
			{ ui: { notify } } as unknown as ExtensionContext,
		);

		await vi.waitFor(() => {
			expect(notify).toHaveBeenCalledWith(
				"Recode 0.82.1-repi.1 is available. Exit Recode and run: recode update",
				"info",
			);
		});

		sessionStart?.(
			{ type: "session_start", reason: "reload" },
			{ ui: { notify } } as unknown as ExtensionContext,
		);
		expect(fetchMock).toHaveBeenCalledTimes(1);
		expect(notify).toHaveBeenCalledTimes(1);
	});
});
