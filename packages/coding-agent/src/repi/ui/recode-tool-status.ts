import type { Theme } from "../../modes/interactive/theme/theme.ts";

export type RecodeToolStatus = "pending" | "running" | "success" | "error";

interface PaletteColor {
	hex: string;
	ansi256: number;
}

const DARK_STATUS_COLORS: Readonly<Record<RecodeToolStatus, PaletteColor>> = {
	pending: { hex: "#7AA2F7", ansi256: 111 },
	running: { hex: "#E0AF68", ansi256: 179 },
	success: { hex: "#22C55E", ansi256: 41 },
	error: { hex: "#EF4444", ansi256: 203 },
};

const LIGHT_STATUS_COLORS: Readonly<Record<RecodeToolStatus, PaletteColor>> = {
	pending: { hex: "#315EBA", ansi256: 25 },
	running: { hex: "#8A6400", ansi256: 94 },
	success: { hex: "#217A3C", ansi256: 29 },
	error: { hex: "#B4233F", ansi256: 124 },
};

export function recodeToolStatusForeground(status: RecodeToolStatus, text: string, theme: Theme): string {
	const palette = theme.name === "light" ? LIGHT_STATUS_COLORS : DARK_STATUS_COLORS;
	const color = palette[status];
	const ansi =
		theme.getColorMode() === "truecolor"
			? `\x1b[38;2;${Number.parseInt(color.hex.slice(1, 3), 16)};${Number.parseInt(color.hex.slice(3, 5), 16)};${Number.parseInt(color.hex.slice(5, 7), 16)}m`
			: `\x1b[38;5;${color.ansi256}m`;
	return `${ansi}${text}\x1b[39m`;
}
