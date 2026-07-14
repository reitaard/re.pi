import type { LoaderIndicatorOptions } from "@earendil-works/pi-tui";
import { theme } from "../theme/theme.ts";

const FRAME_INTERVAL_MS = 50;
const SCRAMBLE_CHARSET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*()_+-={}[];:,.<>/?";
const WORKING_LABEL = "Working...";
const GENERATING_LABEL = "Generating...";
const LOADER_FRAMES = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];

export interface RecodeGeneratingTransition {
	indicator: LoaderIndicatorOptions;
	durationMs: number;
}

/** Creates the default green loader shown beside working-state text. */
export function createRecodeLoaderIndicator(): LoaderIndicatorOptions {
	return {
		frames: LOADER_FRAMES.map((frame) => theme.fg("borderAccent", frame)),
		intervalMs: 80,
	};
}

/** Creates the orange encrypted-text transition from Working to Generating. */
export function createRecodeGeneratingTransition(random: () => number = Math.random): RecodeGeneratingTransition {
	const frames = [`${theme.fg("borderAccent", LOADER_FRAMES[0] ?? "⠋")} ${theme.fg("muted", WORKING_LABEL)}`];

	for (let revealed = 1; revealed <= GENERATING_LABEL.length; revealed++) {
		let frame = "";
		for (let column = 0; column < GENERATING_LABEL.length; column++) {
			if (column < revealed) {
				frame += GENERATING_LABEL[column] ?? "";
				continue;
			}
			const characterIndex = Math.floor(random() * SCRAMBLE_CHARSET.length);
			frame += SCRAMBLE_CHARSET[characterIndex] ?? ".";
		}
		const loader = LOADER_FRAMES[revealed % LOADER_FRAMES.length] ?? "⠋";
		frames.push(`${theme.fg("borderAccent", loader)} ${theme.fg("muted", frame)}`);
	}

	return {
		indicator: { frames, intervalMs: FRAME_INTERVAL_MS },
		durationMs: frames.length * FRAME_INTERVAL_MS,
	};
}
