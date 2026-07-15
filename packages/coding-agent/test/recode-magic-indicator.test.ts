import { beforeAll, describe, expect, it } from "vitest";
import {
	createRecodeGeneratingLoop,
	createRecodeWorkingIndicator,
	RECODE_LIME_PALETTE,
} from "../src/modes/interactive/components/recode-magic-indicator.ts";
import { initTheme } from "../src/modes/interactive/theme/theme.ts";
import { stripAnsi } from "../src/utils/ansi.ts";

describe("re.code generating animation", () => {
	beforeAll(() => {
		initTheme(undefined, false);
	});

	it("keeps the green spinner while animating the Working ellipsis", () => {
		const loader = createRecodeWorkingIndicator("Working...");
		const frames = loader.frames?.map((frame) => stripAnsi(frame)) ?? [];

		expect(loader.intervalMs).toBe(80);
		expect(frames).toHaveLength(20);
		expect(frames.some((frame) => frame.endsWith("Working"))).toBe(true);
		expect(frames.some((frame) => frame.endsWith("Working."))).toBe(true);
		expect(frames.some((frame) => frame.endsWith("Working.."))).toBe(true);
		expect(frames.some((frame) => frame.endsWith("Working..."))).toBe(true);
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
			const [spinner, encryptedBand, ellipsis, extra] = frame.split(" ");
			expect(spinner).toHaveLength(1);
			expect(encryptedBand).toHaveLength(10);
			expect(ellipsis).toMatch(/^\.{0,3}$/);
			expect(extra).toBeUndefined();
			expect(frame).not.toContain("Generating");
		}
		expect(frames.some((frame) => frame.endsWith(" ..."))).toBe(true);
	});
});
