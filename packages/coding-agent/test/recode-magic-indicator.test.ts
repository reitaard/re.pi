import { beforeAll, describe, expect, it } from "vitest";
import {
	createRecodeGeneratingTransition,
	createRecodeLoaderIndicator,
} from "../src/modes/interactive/components/recode-magic-indicator.ts";
import { initTheme } from "../src/modes/interactive/theme/theme.ts";
import { stripAnsi } from "../src/utils/ansi.ts";

describe("re.code generating transition", () => {
	beforeAll(() => {
		initTheme(undefined, false);
	});

	it("deterministically reveals Generating at 20 FPS", () => {
		const seededRandom = () => 0.25;
		const first = createRecodeGeneratingTransition(seededRandom);
		const second = createRecodeGeneratingTransition(seededRandom);

		expect(first.indicator.intervalMs).toBe(50);
		expect(first).toEqual(second);
		expect(stripAnsi(first.indicator.frames?.[0] ?? "")).toContain("Working...");
		expect(stripAnsi(first.indicator.frames?.at(-1) ?? "")).toContain("Generating...");
		expect(first.durationMs).toBe((first.indicator.frames?.length ?? 0) * 50);
	});

	it("keeps the default loader green and animated", () => {
		const loader = createRecodeLoaderIndicator();
		expect(loader.intervalMs).toBe(80);
		expect(loader.frames).toHaveLength(10);
	});
});
