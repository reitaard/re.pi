import type { LoaderIndicatorOptions } from "@reitaard/repi-tui";
import { theme } from "../theme/theme.ts";

const ENCRYPTED_FRAME_INTERVAL_MS = 50;
const WORKING_FRAME_INTERVAL_MS = 80;
const SCRAMBLE_WIDTH = 10;
const LOOP_FRAME_COUNT = 32;
const ELLIPSIS_FRAME_DURATION = 8;
const SCRAMBLE_CHARSET = "0123456789abcdefABCDEF~!@#$£€%^&*()+=_";
const ELLIPSIS_FRAMES = [".", "..", "...", ""];
const LOADER_FRAMES = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];

export const RECODE_LIME_PALETTE = [
	{ hex: "#B7F7D1", ansi256: 194 },
	{ hex: "#8AF0B1", ansi256: 157 },
	{ hex: "#45ED7A", ansi256: 114 },
	{ hex: "#34AD61", ansi256: 71 },
	{ hex: "#257B4A", ansi256: 29 },
] as const;

/** Creates the green spinner with a Working label and animated ellipsis. */
export function createRecodeWorkingIndicator(message: string): LoaderIndicatorOptions {
	const ellipsisOffset = message.indexOf("...");
	const label = ellipsisOffset === -1 ? message : message.slice(0, ellipsisOffset);
	const suffix = ellipsisOffset === -1 ? "" : message.slice(ellipsisOffset + 3);
	const frames = Array.from({ length: 20 }, (_, frameIndex) => {
		const loader = LOADER_FRAMES[frameIndex % LOADER_FRAMES.length] ?? "⠋";
		const ellipsis = ELLIPSIS_FRAMES[Math.floor(frameIndex / 5) % ELLIPSIS_FRAMES.length] ?? "";
		return `${theme.fg("borderAccent", loader)} ${theme.fg("muted", `${label}${ellipsis}${suffix}`)}`;
	});
	return {
		frames,
		intervalMs: WORKING_FRAME_INTERVAL_MS,
	};
}

/** Creates a Crush-style encrypted band with a green spinner and lime ellipsis. */
export function createRecodeGeneratingLoop(random: () => number = Math.random): LoaderIndicatorOptions {
	const frames = Array.from({ length: LOOP_FRAME_COUNT }, (_, frameIndex) => {
		const loader = LOADER_FRAMES[frameIndex % LOADER_FRAMES.length] ?? "⠋";
		let encryptedBand = "";
		for (let column = 0; column < SCRAMBLE_WIDTH; column++) {
			const characterIndex = Math.floor(random() * SCRAMBLE_CHARSET.length);
			const character = SCRAMBLE_CHARSET[characterIndex] ?? ".";
			encryptedBand += limeFg(character, column + frameIndex);
		}
		const ellipsisIndex = Math.floor(frameIndex / ELLIPSIS_FRAME_DURATION) % ELLIPSIS_FRAMES.length;
		const ellipsis = ELLIPSIS_FRAMES[ellipsisIndex] ?? "";
		return `${theme.fg("borderAccent", loader)} ${encryptedBand} ${limeText(ellipsis, frameIndex)}`;
	});
	return { frames, intervalMs: ENCRYPTED_FRAME_INTERVAL_MS };
}

function limeText(text: string, paletteOffset: number): string {
	return [...text].map((character, index) => limeFg(character, paletteOffset + index)).join("");
}

function limeFg(text: string, paletteIndex: number): string {
	const color = RECODE_LIME_PALETTE[paletteIndex % RECODE_LIME_PALETTE.length] ?? RECODE_LIME_PALETTE[0];
	const ansi =
		theme.getColorMode() === "truecolor"
			? `\x1b[38;2;${Number.parseInt(color.hex.slice(1, 3), 16)};${Number.parseInt(color.hex.slice(3, 5), 16)};${Number.parseInt(color.hex.slice(5, 7), 16)}m`
			: `\x1b[38;5;${color.ansi256}m`;
	return `${ansi}${text}\x1b[39m`;
}
