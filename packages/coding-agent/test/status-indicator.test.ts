import type { TUI } from "@reitaard/repi-tui";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
	IdleStatus,
	RetryStatusIndicator,
	WorkingStatusIndicator,
} from "../src/modes/interactive/components/status-indicator.ts";
import { initTheme } from "../src/modes/interactive/theme/theme.ts";
import { stripAnsi } from "../src/utils/ansi.ts";

describe("status indicators", () => {
	afterEach(() => {
		vi.useRealTimers();
	});

	it("keeps idle status at the same height as status indicators", () => {
		const idleStatus = new IdleStatus();

		const lines = idleStatus.render(20);
		expect(lines).toHaveLength(2);
		expect(lines).toEqual([" ".repeat(20), " ".repeat(20)]);
	});

	it("disposes retry countdown updates", () => {
		initTheme("dark");
		vi.useFakeTimers();
		const requestRender = vi.fn();
		const tui = { requestRender } as unknown as TUI;
		const indicator = new RetryStatusIndicator(tui, 1, 3, 1000);
		const callsBeforeDispose = requestRender.mock.calls.length;

		indicator.dispose();
		vi.advanceTimersByTime(2000);

		expect(requestRender).toHaveBeenCalledTimes(callsBeforeDispose);
	});

	it("starts and keeps the encrypted animation running", () => {
		initTheme("dark");
		vi.useFakeTimers();
		const requestRender = vi.fn();
		const tui = { requestRender } as unknown as TUI;
		const indicator = new WorkingStatusIndicator(tui, "Working...");
		indicator.setGenerating();
		vi.advanceTimersByTime(3200);
		const callsAfterTwoLoops = requestRender.mock.calls.length;
		vi.advanceTimersByTime(1100);

		expect(requestRender.mock.calls.length).toBeGreaterThan(callsAfterTwoLoops);
		indicator.dispose();
		const callsBeforeDispose = requestRender.mock.calls.length;
		vi.advanceTimersByTime(1100);
		expect(requestRender).toHaveBeenCalledTimes(callsBeforeDispose);
	});

	it("right-aligns the live run time opposite the default encrypted animation", () => {
		initTheme("dark");
		vi.useFakeTimers();
		const tui = { requestRender: vi.fn() } as unknown as TUI;
		const indicator = new WorkingStatusIndicator(tui, "Working...");

		const initialLine = stripAnsi(indicator.render(80).at(-1) ?? "");
		expect(initialLine.endsWith("· 0s")).toBe(true);
		vi.advanceTimersByTime(61_000);
		const elapsedLine = stripAnsi(indicator.render(80).at(-1) ?? "");
		expect(elapsedLine.endsWith("· 1m 01s")).toBe(true);

		indicator.dispose();
	});
});
