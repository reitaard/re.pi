import { readFileSync } from "node:fs";
import { type RgbColor, resetCapabilitiesCache, setCapabilities } from "@reitaard/repi-tui";
import { afterEach, describe, expect, it } from "vitest";
import {
	detectTerminalBackgroundFromEnv,
	detectTerminalBackgroundTheme,
	getThemeByName,
	getThemeForRgbColor,
	parseAutoThemeSetting,
	resolveThemeSetting,
} from "../src/modes/interactive/theme/theme.ts";

afterEach(() => {
	resetCapabilitiesCache();
});

describe("detectTerminalBackgroundFromEnv", () => {
	it("uses the COLORFGBG background color index", () => {
		expect(detectTerminalBackgroundFromEnv({ env: { COLORFGBG: "0;15" } })).toMatchObject({
			theme: "light",
			source: "COLORFGBG",
			confidence: "high",
		});
		expect(detectTerminalBackgroundFromEnv({ env: { COLORFGBG: "15;0" } })).toMatchObject({
			theme: "dark",
			source: "COLORFGBG",
			confidence: "high",
		});
	});

	it("uses the last COLORFGBG field as the background", () => {
		expect(detectTerminalBackgroundFromEnv({ env: { COLORFGBG: "0;7;15" } }).theme).toBe("light");
	});

	it("defaults to dark without terminal background hints", () => {
		expect(detectTerminalBackgroundFromEnv({ env: {} })).toMatchObject({
			theme: "dark",
			source: "fallback",
			confidence: "low",
		});
	});
});

describe("detectTerminalBackgroundTheme", () => {
	it("uses the queried terminal background before environment hints", async () => {
		let queriedTimeoutMs: number | undefined;
		const detection = await detectTerminalBackgroundTheme({
			env: { COLORFGBG: "15;0" },
			timeoutMs: 250,
			ui: {
				async queryTerminalBackgroundColor({ timeoutMs }: { timeoutMs: number }): Promise<RgbColor | undefined> {
					queriedTimeoutMs = timeoutMs;
					return { r: 250, g: 250, b: 250 };
				},
			},
		});

		expect(queriedTimeoutMs).toBe(250);
		expect(detection).toMatchObject({
			theme: "light",
			source: "terminal background",
			confidence: "high",
		});
	});

	it("falls back to environment hints when the terminal query returns no color", async () => {
		const detection = await detectTerminalBackgroundTheme({
			env: { COLORFGBG: "15;0" },
			timeoutMs: 250,
			ui: {
				async queryTerminalBackgroundColor(): Promise<RgbColor | undefined> {
					return undefined;
				},
			},
		});

		expect(detection).toMatchObject({
			theme: "dark",
			source: "COLORFGBG",
			confidence: "high",
		});
	});

	it("falls back to environment hints when the terminal query fails", async () => {
		const detection = await detectTerminalBackgroundTheme({
			env: { COLORFGBG: "0;15" },
			timeoutMs: 250,
			ui: {
				async queryTerminalBackgroundColor(): Promise<RgbColor | undefined> {
					throw new Error("terminal write failed");
				},
			},
		});

		expect(detection).toMatchObject({
			theme: "light",
			source: "COLORFGBG",
			confidence: "high",
		});
	});
});

describe("theme color mode", () => {
	it("keeps text teal while borders and successful tool surfaces use violet", () => {
		const darkTheme = JSON.parse(
			readFileSync(new URL("../src/modes/interactive/theme/dark.json", import.meta.url), "utf-8"),
		) as {
			vars: Record<string, string | number>;
			colors: Record<string, string>;
		};

		expect(darkTheme.vars.teal).toBe("#00B6B9");
		expect(darkTheme.vars.violetLine).toBe("#8297E8");
		expect(darkTheme.vars.teal).not.toBe(darkTheme.vars.violetLine);
		expect(darkTheme.vars.violetSurface).toBe("#332E4A");
		expect(darkTheme.vars.successSurface).toBe("#344C38");
		expect(darkTheme.vars.errorSurface).toBe("#54363C");
		expect(darkTheme.vars.pendingStatus).toBe("#7AA2F7");
		expect(darkTheme.vars.runningStatus).toBe("#E0AF68");
		expect(darkTheme.vars.successStatus).toBe("#22C55E");
		expect(darkTheme.vars.errorStatus).toBe("#EF4444");
		expect(darkTheme.colors.dim).toBe("teal");
		expect(darkTheme.colors.footer).toBe("teal");
		expect(darkTheme.vars.toolPendingBg).toBe("violetSurface");
		expect(darkTheme.vars.toolSuccessBg).toBe("successSurface");
		expect(darkTheme.vars.toolErrorBg).toBe("errorSurface");
		expect(darkTheme.colors.toolPendingStatus).toBe("pendingStatus");
		expect(darkTheme.colors.toolRunningStatus).toBe("runningStatus");
		expect(darkTheme.colors.toolSuccessStatus).toBe("successStatus");
		expect(darkTheme.colors.toolErrorStatus).toBe("errorStatus");
	});

	it("uses terminal capabilities", () => {
		setCapabilities({ images: null, trueColor: false, hyperlinks: false });
		const ansi256Theme = getThemeByName("dark");
		if (!ansi256Theme) throw new Error("dark theme not found");
		expect(ansi256Theme.getColorMode()).toBe("256color");
		expect(ansi256Theme.getFgAnsi("accent")).toMatch(/^\x1b\[38;5;\d+m$/);

		setCapabilities({ images: null, trueColor: true, hyperlinks: false });
		const truecolorTheme = getThemeByName("dark");
		if (!truecolorTheme) throw new Error("dark theme not found");
		expect(truecolorTheme.getColorMode()).toBe("truecolor");
		expect(truecolorTheme.getFgAnsi("accent")).toMatch(/^\x1b\[38;2;\d+;\d+;\d+m$/);
		expect(truecolorTheme.getBgAnsi("toolPendingBg")).toBe("\x1b[48;2;51;46;74m");
		expect(truecolorTheme.getBgAnsi("toolSuccessBg")).toBe("\x1b[48;2;52;76;56m");
		expect(truecolorTheme.getBgAnsi("toolErrorBg")).toBe("\x1b[48;2;84;54;60m");
		expect(truecolorTheme.getFgAnsi("toolPendingStatus")).toBe("\x1b[38;2;122;162;247m");
		expect(truecolorTheme.getFgAnsi("toolRunningStatus")).toBe("\x1b[38;2;224;175;104m");
		expect(truecolorTheme.getFgAnsi("toolSuccessStatus")).toBe("\x1b[38;2;34;197;94m");
		expect(truecolorTheme.getFgAnsi("toolErrorStatus")).toBe("\x1b[38;2;239;68;68m");
	});

	it("uses dedicated readable surfaces and statuses in light mode", () => {
		setCapabilities({ images: null, trueColor: true, hyperlinks: false });
		const lightTheme = getThemeByName("light");
		if (!lightTheme) throw new Error("light theme not found");

		expect(lightTheme.getBgAnsi("toolPendingBg")).toBe("\x1b[48;2;238;242;255m");
		expect(lightTheme.getBgAnsi("toolSuccessBg")).toBe("\x1b[48;2;234;245;236m");
		expect(lightTheme.getBgAnsi("toolErrorBg")).toBe("\x1b[48;2;251;234;236m");
		expect(lightTheme.getFgAnsi("toolPendingStatus")).toBe("\x1b[38;2;49;94;186m");
		expect(lightTheme.getFgAnsi("toolRunningStatus")).toBe("\x1b[38;2;138;100;0m");
		expect(lightTheme.getFgAnsi("toolSuccessStatus")).toBe("\x1b[38;2;33;122;60m");
		expect(lightTheme.getFgAnsi("toolErrorStatus")).toBe("\x1b[38;2;180;35;63m");
	});
});

describe("theme detection from RGB", () => {
	it("classifies RGB colors by luminance", () => {
		expect(getThemeForRgbColor({ r: 8, g: 8, b: 8 })).toBe("dark");
		expect(getThemeForRgbColor({ r: 250, g: 250, b: 250 })).toBe("light");
	});
});

describe("theme setting helpers", () => {
	it("parses and resolves automatic theme settings", () => {
		expect(parseAutoThemeSetting("light/dark")).toEqual({ lightTheme: "light", darkTheme: "dark" });
		expect(resolveThemeSetting("dark", "light")).toBe("dark");
		expect(resolveThemeSetting("light/dark", "light")).toBe("light");
		expect(resolveThemeSetting("light/dark", "dark")).toBe("dark");
		expect(resolveThemeSetting("light/dark/extra", "dark")).toBeUndefined();
	});
});
