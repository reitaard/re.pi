import { stripVTControlCharacters } from "node:util";
import { beforeEach, describe, expect, it } from "vitest";
import { initTheme, theme } from "../src/modes/interactive/theme/theme.ts";
import { RecodeHeader } from "../src/repi/ui/recode-header.ts";
import { workerForeground } from "../src/repi/ui/recode-worker-indicator.ts";

describe("RePi RecodeHeader", () => {
	beforeEach(() => initTheme("dark"));

	const createHeader = (isVisible = () => true) =>
		new RecodeHeader(
			"0.82.1-repi.2.dev.1.abcdef12",
			isVisible,
			() => ({
				model: "gpt-5.6-sol",
				provider: "openai-oauth",
				cwd: "~/Desktop/chat7/re.pi",
			}),
			theme,
		);

	it("renders the wide two-column Recode welcome box", () => {
		const lines = createHeader().render(100).map(stripVTControlCharacters);

		expect(lines).toHaveLength(9);
		expect(lines[0]).toContain("re.pi v0.82.1-repi.2.dev.1.abcdef12");
		expect(lines[1]).toContain("Welcome to re™");
		expect(lines[1]).toContain("Tips for getting started");
		expect(lines[3]).toContain("▄▀▀▀▀▀ █▀▀▀▀█ █▀▀▀▀▄ █▀▀▀▀▀");
		expect(lines[6]).toContain("gpt-5.6-sol · openai-oauth");
		expect(lines.every((line) => line.length === 100)).toBe(true);
	});

	it("reflows into a single-column box at medium widths", () => {
		const lines = createHeader().render(64).map(stripVTControlCharacters);

		expect(lines).toHaveLength(9);
		expect(lines[1]).toContain("▄▀▀▀▀▀ █▀▀▀▀█ █▀▀▀▀▄ █▀▀▀▀▀");
		expect(lines[4]).toContain("gpt-5.6-sol · openai-oauth");
		expect(lines[6]).toContain("/ commands · ! bash · Ctrl+O help");
		expect(lines.every((line) => line.length === 64)).toBe(true);
	});

	it("uses a compact Recode brand below the boxed-layout breakpoint", () => {
		const lines = createHeader().render(40).map(stripVTControlCharacters);

		expect(lines).toEqual([expect.stringContaining("re™ CODE v0.82.1-repi.2")]);
		expect(lines[0]!.length).toBeLessThanOrEqual(40);
	});

	it("keeps the fixed brand palette across light and dark themes", () => {
		const darkBrand = createHeader().render(40);
		initTheme("light");
		const lightBrand = createHeader().render(40);

		expect(lightBrand).toEqual(darkBrand);
	});

	it("recalculates layout when terminal width changes", () => {
		const header = createHeader();

		expect(header.render(100)).toHaveLength(9);
		expect(header.render(64)).toHaveLength(9);
		expect(header.render(40)).toHaveLength(1);
		expect(header.render(100)).toHaveLength(9);
	});

	it("keeps the logo and replaces helper content during worker chat", () => {
		const header = new RecodeHeader(
			"0.82.1-repi.2",
			() => true,
			() => ({
				model: "gpt-5.6-sol",
				provider: "openai-oauth",
				cwd: "re.pi",
				worker: {
					workerId: "research",
					workerName: "Mayuri (研究)",
					status: "ready",
					turnCount: 3,
					memoryDocumentCount: 7,
					sessionCount: 2,
					evaluationCount: 1,
				},
			}),
			theme,
		);
		const rendered = header.render(100);
		const text = rendered.map(stripVTControlCharacters).join("\n");
		const styled = rendered.join("\n");

		expect(text).toContain("Welcome to re™");
		expect(text).toContain("Direct chat · Mayuri (研究)");
		expect(text).toContain("Memory       7 documents");
		expect(text).toContain("Progress     2 sessions · 3 turns");
		expect(text).not.toContain("Tips for getting started");
		expect(styled).toContain(theme.fg("success", "ready"));
		expect(styled).toContain(workerForeground("research", "text", " Memory       ", theme));
	});

	it("does not occupy rows after the welcome state", () => {
		const header = createHeader(() => false);
		expect(header.render(120)).toEqual([]);
	});
});
