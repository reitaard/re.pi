import type { ExtensionAPI } from "../../core/extensions/types.ts";
import { checkForRepiUpdate } from "./release.ts";

export async function repiUpdateNotifier(pi: ExtensionAPI): Promise<void> {
	let notified = false;

	pi.on("session_start", (event, ctx) => {
		if (event.reason !== "startup" || notified || process.env.PI_OFFLINE) return;
		notified = true;
		void checkForRepiUpdate().then((release) => {
			if (!release) return;
			ctx.ui.notify(
				`Recode ${release.version} is available. Exit Recode and run: recode update`,
				"info",
			);
		});
	});
}
