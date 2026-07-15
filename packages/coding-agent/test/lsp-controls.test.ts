import { describe, expect, test } from "vitest";
import { SettingsManager } from "../src/core/settings-manager.ts";
import { BUILTIN_SLASH_COMMANDS } from "../src/core/slash-commands.ts";
import { parseLspControlCommand } from "../src/lsp/controls.ts";

describe("LSP user controls", () => {
	test("parses global, per-server, and lspmux commands", () => {
		expect(parseLspControlCommand("/lsp")).toEqual({ target: "lsp", action: "status" });
		expect(parseLspControlCommand("/lsp off")).toEqual({ target: "lsp", action: "disable" });
		expect(parseLspControlCommand("/lsp server rust-analyzer on")).toEqual({
			target: "lsp",
			action: "server",
			server: "rust-analyzer",
			enabled: true,
		});
		expect(parseLspControlCommand("/lspmux enable")).toEqual({ target: "lspmux", action: "enable" });
		expect(parseLspControlCommand("/lsp server rust-analyzer maybe")).toBeNull();
	});

	test("persists LSP and lspmux preferences", async () => {
		const settings = SettingsManager.inMemory();
		settings.setLspEnabled(false);
		settings.setLspmuxEnabled(false);
		settings.setLspServerEnabled("rust-analyzer", false);
		await settings.flush();
		await settings.reload();
		expect(settings.getLspSettings()).toEqual({
			enabled: false,
			lspmux: false,
			servers: { "rust-analyzer": false },
		});
	});

	test("registers both controls for slash-command autocomplete", () => {
		const names = BUILTIN_SLASH_COMMANDS.map((command) => command.name);
		expect(names).toContain("lsp");
		expect(names).toContain("lspmux");
	});
});
