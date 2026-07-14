import { describe, expect, it } from "vitest";
import {
	applyRecodeTerminalBackground,
	resetRecodeTerminalBackground,
} from "../src/modes/interactive/recode-terminal-background.ts";

describe("re.code terminal background", () => {
	it("applies the grey canvas and restores the terminal profile background", () => {
		const writes: string[] = [];
		const terminal = { write: (data: string) => writes.push(data) };

		applyRecodeTerminalBackground(terminal);
		resetRecodeTerminalBackground(terminal);

		expect(writes).toEqual(["\x1b]11;#201F26\x07", "\x1b]111\x07"]);
	});
});
