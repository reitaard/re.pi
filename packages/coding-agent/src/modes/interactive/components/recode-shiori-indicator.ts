import type { LoaderIndicatorOptions } from "@reitaard/repi-tui";
import { RECODE_SHIORI_DISPLAY_NAME } from "../../../core/recode-memory/recode-shiori.ts";
import type { Theme } from "../theme/theme.ts";
import { RECODE_LIGHT_LIME_PALETTE, RECODE_LIME_PALETTE } from "./recode-magic-indicator.ts";

const SHIORI_STAR_FRAMES = ["✦", "✧", "⋆", "✧"] as const;
const SHIORI_SHIMMER_INTERVAL_MS = 80;
const SHIORI_SHIMMER_RADIUS = 4;

function paletteForeground(text: string, paletteIndex: number, activeTheme: Theme): string {
	const palette = activeTheme.name === "light" ? RECODE_LIGHT_LIME_PALETTE : RECODE_LIME_PALETTE;
	const color = palette[Math.min(palette.length - 1, Math.max(0, paletteIndex))] ?? palette[2]!;
	const ansi =
		activeTheme.getColorMode() === "truecolor"
			? `\x1b[38;2;${Number.parseInt(color.hex.slice(1, 3), 16)};${Number.parseInt(color.hex.slice(3, 5), 16)};${Number.parseInt(color.hex.slice(5, 7), 16)}m`
			: `\x1b[38;5;${color.ansi256}m`;
	return `${ansi}${text}\x1b[39m`;
}

/** Creates a star spinner with a moving lime highlight across the complete Shiori line. */
export function createRecodeShioriIndicator(message: string, activeTheme: Theme): LoaderIndicatorOptions {
	const text = `${RECODE_SHIORI_DISPLAY_NAME}: ${message}`;
	const characters = Array.from(text);
	const italicSuffixStart = text.search(/\(\d+ entries\)$/);
	const frameCount = Math.max(12, Math.ceil((characters.length + SHIORI_SHIMMER_RADIUS * 2) / 2));
	const frames = Array.from({ length: frameCount }, (_, frameIndex) => {
		const shimmerCenter = frameIndex * 2 - SHIORI_SHIMMER_RADIUS;
		const star = SHIORI_STAR_FRAMES[frameIndex % SHIORI_STAR_FRAMES.length] ?? "✦";
		const renderedText = characters
			.map((character, characterIndex) => {
				const distance = Math.abs(characterIndex - shimmerCenter);
				const paletteIndex = distance === 0 ? 0 : distance <= 2 ? 1 : distance <= SHIORI_SHIMMER_RADIUS ? 2 : 3;
				let rendered = paletteForeground(character, paletteIndex, activeTheme);
				if (characterIndex === italicSuffixStart) rendered = `\x1b[3m${rendered}`;
				if (italicSuffixStart >= 0 && characterIndex === characters.length - 1) rendered = `${rendered}\x1b[23m`;
				return rendered;
			})
			.join("");
		return `${paletteForeground(star, frameIndex % 3, activeTheme)} ${renderedText}`;
	});
	return { frames, intervalMs: SHIORI_SHIMMER_INTERVAL_MS };
}
