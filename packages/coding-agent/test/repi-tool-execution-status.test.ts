import { stripVTControlCharacters } from "node:util";
import type { TUI } from "@earendil-works/pi-tui";
import { beforeEach, describe, expect, it } from "vitest";
import type { ToolDefinition } from "../src/core/extensions/types.ts";
import { ToolExecutionComponent } from "../src/modes/interactive/components/tool-execution.ts";
import { initTheme, theme } from "../src/modes/interactive/theme/theme.ts";
import { recodeToolStatusForeground } from "../src/repi/ui/recode-tool-status.ts";

function tui(): TUI {
	return { requestRender() {} } as unknown as TUI;
}

function customTool(label: string): ToolDefinition {
	return { label, renderShell: "default" } as unknown as ToolDefinition;
}

function rendered(component: ToolExecutionComponent): { raw: string; plain: string } {
	const raw = component.render(80).join("\n");
	return { raw, plain: stripVTControlCharacters(raw) };
}

describe("Recode tool execution lifecycle surface", () => {
	beforeEach(() => initTheme("dark"));

	it("renders an account connector as connecting before execution", () => {
		const component = new ToolExecutionComponent(
			"mcp_adapter",
			"call-1",
			{ connect: "github" },
			{},
			customTool("MCP Adapter"),
			tui(),
			process.cwd(),
		);
		const output = rendered(component);

		expect(output.plain).toContain("Github: Connecting...");
		expect(output.raw).toContain(recodeToolStatusForeground("pending", "▎", theme));
	});

	it("uses purpose-specific pending labels for memory and LSP tools", () => {
		const memory = new ToolExecutionComponent(
			"kioku_memory_search",
			"call-memory",
			{},
			{},
			customTool("Kioku Memory"),
			tui(),
			process.cwd(),
		);
		const lsp = new ToolExecutionComponent(
			"lsp_diagnostics",
			"call-lsp",
			{},
			{},
			customTool("Language Server"),
			tui(),
			process.cwd(),
		);

		expect(rendered(memory).plain).toContain("Kioku Memory: Recalling...");
		expect(rendered(lsp).plain).toContain("LSP: Analyzing...");
	});

	it("changes only the status rail as execution progresses", () => {
		const component = new ToolExecutionComponent(
			"custom_search",
			"call-2",
			{ query: "Recode" },
			{},
			customTool("Custom Search"),
			tui(),
			process.cwd(),
		);

		expect(rendered(component).raw).toContain(recodeToolStatusForeground("pending", "▎", theme));
		component.markExecutionStarted();
		expect(rendered(component).raw).toContain(recodeToolStatusForeground("running", "▎", theme));
		component.updateResult({ content: [{ type: "text", text: "found" }], isError: false });
		expect(rendered(component).raw).toContain(recodeToolStatusForeground("success", "▎", theme));
	});

	it("renders a distinct error rail for failed tools", () => {
		const component = new ToolExecutionComponent(
			"custom_fetch",
			"call-3",
			{},
			{},
			customTool("Custom Fetch"),
			tui(),
			process.cwd(),
		);
		component.markExecutionStarted();
		component.updateResult({ content: [{ type: "text", text: "failed" }], isError: true });

		expect(rendered(component).raw).toContain(recodeToolStatusForeground("error", "▎", theme));
	});
});
