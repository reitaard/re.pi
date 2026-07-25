import { homedir } from "node:os";
import { basename } from "node:path";
import type { ExtensionAPI } from "../../core/extensions/types.ts";
import { RecodeHeader, type RecodeHeaderDetails } from "./recode-header.ts";

function displayCwd(cwd: string): string {
	const normalized = cwd.replaceAll("\\", "/");
	const home = homedir().replaceAll("\\", "/").replace(/\/$/, "");
	if (normalized === home) return "~";
	if (normalized.startsWith(`${home}/`)) return `~${normalized.slice(home.length)}`;
	return normalized;
}

function selectedModel(ctx: { model: { id: string; provider: string } | undefined }): Pick<RecodeHeaderDetails, "model" | "provider"> {
	return {
		model: ctx.model?.id ?? "No model selected",
		provider: ctx.model?.provider ?? "unknown",
	};
}

export function repiProductUi(pi: ExtensionAPI): void {
	const version = process.env.REPI_VERSION ?? "development";
	let details: RecodeHeaderDetails = {
		model: "No model selected",
		provider: "unknown",
		cwd: displayCwd(process.cwd()),
	};

	pi.on("session_start", (_event, ctx) => {
		if (ctx.mode !== "tui") return;
		details = {
			...details,
			...selectedModel(ctx),
			cwd: displayCwd(ctx.cwd),
		};
		ctx.ui.setTitle(`Recode — ${basename(ctx.cwd) || "session"}`);
		ctx.ui.setHeader((_tui, theme) => new RecodeHeader(version, () => details, theme));
	});

	pi.on("model_select", (event, ctx) => {
		details = {
			...details,
			model: event.model.id,
			provider: event.model.provider,
			cwd: displayCwd(ctx.cwd),
		};
	});
}
