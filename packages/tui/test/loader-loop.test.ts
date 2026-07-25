import assert from "node:assert";
import { describe, it } from "node:test";
import { Loader } from "../src/components/loader.ts";
import { TUI } from "../src/tui.ts";
import { VirtualTerminal } from "./virtual-terminal.ts";

function createTestTUI(): TUI {
	return new TUI(new VirtualTerminal(80, 24));
}

describe("Loader one-shot introduction", () => {
	it("returns to loopFromFrame instead of replaying the introduction", async (context) => {
		context.mock.timers.enable({ apis: ["setInterval"] });
		const loader = new Loader(
			createTestTUI(),
			(text) => text,
			(text) => text,
			"",
			{ frames: ["intro", "loop-a", "loop-b"], intervalMs: 10, loopFromFrame: 1 },
		);

		assert.match(loader.render(80).join("\n"), /intro/);
		context.mock.timers.tick(10);
		assert.match(loader.render(80).join("\n"), /loop-a/);
		context.mock.timers.tick(10);
		assert.match(loader.render(80).join("\n"), /loop-b/);
		context.mock.timers.tick(10);
		assert.match(loader.render(80).join("\n"), /loop-a/);
		assert.doesNotMatch(loader.render(80).join("\n"), /intro/);

		loader.stop();
	});
});
