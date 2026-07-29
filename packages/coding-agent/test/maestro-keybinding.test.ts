import { describe, expect, it } from "vitest";
import { KEYBINDINGS, KeybindingsManager } from "../src/core/keybindings.ts";

describe("Maestro terminal-safe keybindings", () => {
	it("keeps Alt+Up while providing a VS Code terminal-safe dequeue fallback", () => {
		expect(KEYBINDINGS["app.message.dequeue"].defaultKeys).toEqual(["alt+up", "ctrl+shift+j"]);
		const manager = new KeybindingsManager();
		expect(manager.getKeys("app.message.dequeue")).toEqual(["alt+up", "ctrl+shift+j"]);
	});
});
