import { ProcessTerminal } from "@earendil-works/pi-tui";
import { applyRecodeTerminalBackground, resetRecodeTerminalBackground } from "./recode-terminal-background.ts";

/** Process terminal that owns the re.code background lifecycle. */
export class RecodeProcessTerminal extends ProcessTerminal {
	override start(onInput: (data: string) => void, onResize: () => void): void {
		super.start(onInput, onResize);
		applyRecodeTerminalBackground(this);
	}

	override stop(): void {
		resetRecodeTerminalBackground(this);
		super.stop();
	}
}
