import { describe, expect, it } from "vitest";
import {
	prepareRecodeTerminalViewport,
	readCurrentWindowSize,
} from "../src/modes/interactive/recode-process-terminal.ts";

describe("re.code process terminal", () => {
	it("reads the live terminal dimensions instead of cached stdout fields", () => {
		expect(readCurrentWindowSize({ getWindowSize: () => [191, 47] })).toEqual([191, 47]);
	});

	it("falls back when live dimensions are unavailable", () => {
		expect(readCurrentWindowSize({ getWindowSize: () => [0, 0] })).toBeUndefined();
		expect(
			readCurrentWindowSize({
				getWindowSize: () => {
					throw new Error("terminal unavailable");
				},
			}),
		).toBeUndefined();
	});

	it("clears and homes the viewport before the first render", () => {
		const operations: string[] = [];
		prepareRecodeTerminalViewport({
			write: (data) => operations.push(`write:${data}`),
			clearScreen: () => operations.push("clearScreen"),
		});

		expect(operations).toEqual(["write:\x1b]111\x07", "clearScreen"]);
	});
});
