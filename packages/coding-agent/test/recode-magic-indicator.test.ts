import { beforeAll, describe, expect, it } from "vitest";
import {
	createRecodeGeneratingLoop,
	createRecodeMagicIndicator,
	RECODE_LIME_PALETTE,
	RECODE_SPINNER_VERBS,
} from "../src/modes/interactive/components/recode-magic-indicator.ts";
import { initTheme } from "../src/modes/interactive/theme/theme.ts";
import { stripAnsi } from "../src/utils/ansi.ts";

describe("re.code generating animation", () => {
	beforeAll(() => {
		initTheme(undefined, false);
	});

	it("plays a sourced verb once before looping only the encrypted tail", () => {
		const loader = createRecodeMagicIndicator("Nucleating", () => 0.25);
		const frames = loader.frames?.map((frame) => stripAnsi(frame)) ?? [];

		expect(RECODE_SPINNER_VERBS).toHaveLength(48);
		expect(RECODE_SPINNER_VERBS).not.toContain("Working");
		expect(loader.intervalMs).toBe(50);
		expect(loader.loopFromFrame).toBeGreaterThan(0);
		expect(frames[0]).toContain("Nucleating");
		expect(frames.slice(loader.loopFromFrame)).not.toContainEqual(expect.stringContaining("Nucleating"));
		expect(frames.slice(0, 40).every((frame) => /Nucleating\.{0,3}$/.test(frame))).toBe(true);
		expect(frames.slice(0, 40).some((frame) => frame.endsWith("Nucleating."))).toBe(true);
		expect(frames.slice(0, 40).some((frame) => frame.endsWith("Nucleating.."))).toBe(true);
		expect(frames.slice(0, 40).some((frame) => frame.endsWith("Nucleating..."))).toBe(true);
		expect(new Set(frames.slice(0, 40)).size).toBeGreaterThan(1);
		expect(frames.slice(40, loader.loopFromFrame).some((frame) => frame.includes("Nucleat"))).toBe(true);
		expect(frames.slice(40, loader.loopFromFrame).some((frame) => !frame.includes("Nucleating"))).toBe(true);
	});

	it("loops a five-shade lime encrypted band without a Generating label", () => {
		const loop = createRecodeGeneratingLoop(() => 0.25);
		const frames = loop.frames?.map((frame) => stripAnsi(frame)) ?? [];

		expect(RECODE_LIME_PALETTE.map((color) => color.hex)).toEqual([
			"#B7F7D1",
			"#8AF0B1",
			"#45ED7A",
			"#34AD61",
			"#257B4A",
		]);
		expect(loop.intervalMs).toBe(50);
		expect(frames).toHaveLength(32);
		for (const frame of frames) {
			const [spinner, encryptedBand, extra] = frame.split(" ");
			expect(spinner).toHaveLength(1);
			expect(encryptedBand).toMatch(/^.{10}\.{0,3}$/);
			expect(extra).toBeUndefined();
			expect(frame).not.toContain("Generating");
		}
		expect(frames.some((frame) => frame.endsWith("..."))).toBe(true);
	});
});
