import type { Theme } from "../../modes/interactive/theme/theme.ts";

interface PaletteColor {
	hex: string;
	ansi256: number;
}

type WorkerTone = "identity" | "text" | "rail";

const DARK_WORKER_PALETTES: Readonly<Record<string, readonly PaletteColor[]>> = {
	research: [
		{ hex: "#B7F7D1", ansi256: 194 },
		{ hex: "#8AF0B1", ansi256: 157 },
		{ hex: "#45ED7A", ansi256: 114 },
		{ hex: "#257B4A", ansi256: 29 },
	],
	audit: [
		{ hex: "#D5DDFB", ansi256: 189 },
		{ hex: "#B5C1F3", ansi256: 147 },
		{ hex: "#8297E8", ansi256: 105 },
		{ hex: "#5267B8", ansi256: 61 },
	],
};

const LIGHT_WORKER_PALETTES: Readonly<Record<string, readonly PaletteColor[]>> = {
	research: [
		{ hex: "#145A43", ansi256: 23 },
		{ hex: "#1C6B4B", ansi256: 29 },
		{ hex: "#247A45", ansi256: 29 },
		{ hex: "#356B4A", ansi256: 23 },
	],
	audit: [
		{ hex: "#334B9B", ansi256: 61 },
		{ hex: "#405AAE", ansi256: 61 },
		{ hex: "#5267B8", ansi256: 61 },
		{ hex: "#6573A8", ansi256: 67 },
	],
};

function ansiForeground(text: string, color: PaletteColor, activeTheme: Theme): string {
	const ansi =
		activeTheme.getColorMode() === "truecolor"
			? `\x1b[38;2;${Number.parseInt(color.hex.slice(1, 3), 16)};${Number.parseInt(color.hex.slice(3, 5), 16)};${Number.parseInt(color.hex.slice(5, 7), 16)}m`
			: `\x1b[38;5;${color.ansi256}m`;
	return `${ansi}${text}\x1b[39m`;
}

function workerPalette(workerId: string, activeTheme: Theme): readonly PaletteColor[] {
	const palettes = activeTheme.name === "light" ? LIGHT_WORKER_PALETTES : DARK_WORKER_PALETTES;
	return palettes[workerId] ?? palettes.audit!;
}

export function workerForeground(workerId: string, tone: WorkerTone, text: string, activeTheme: Theme): string {
	const palette = workerPalette(workerId, activeTheme);
	const index = tone === "identity" ? 2 : tone === "text" ? 1 : 3;
	return ansiForeground(text, palette[index] ?? palette[0]!, activeTheme);
}
