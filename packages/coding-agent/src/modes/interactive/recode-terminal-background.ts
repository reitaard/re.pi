import type { Terminal } from "@earendil-works/pi-tui";

const RECODE_TERMINAL_BACKGROUND = "\x1b]11;#201F26\x07";
const RESET_TERMINAL_BACKGROUND = "\x1b]111\x07";

type WritableTerminal = Pick<Terminal, "write">;

/** Applies the re.code canvas color to a compatible terminal. */
export function applyRecodeTerminalBackground(terminal: WritableTerminal): void {
	terminal.write(RECODE_TERMINAL_BACKGROUND);
}

/** Restores the terminal profile's configured background color. */
export function resetRecodeTerminalBackground(terminal: WritableTerminal): void {
	terminal.write(RESET_TERMINAL_BACKGROUND);
}
