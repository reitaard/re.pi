import { homedir } from "node:os";
import { basename } from "node:path";
import type { ExtensionAPI, ExtensionContext } from "../../core/extensions/types.ts";
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

function hasConversation(ctx: ExtensionContext): boolean {
	return ctx.sessionManager
		.getEntries()
		.some((entry) => entry.type === "message" || entry.type === "custom_message");
}

export function repiProductUi(pi: ExtensionAPI): void {
	const version = process.env.REPI_VERSION ?? "development";
	let visible = true;
	let details: RecodeHeaderDetails = {
		model: "No model selected",
		provider: "unknown",
		cwd: displayCwd(process.cwd()),
	};

	const installHeader = (ctx: ExtensionContext): void => {
		ctx.ui.setHeader((_tui, theme) => new RecodeHeader(version, () => visible, () => details, theme));
	};

	pi.on("session_start", (_event, ctx) => {
		if (ctx.mode !== "tui") return;
		visible = !hasConversation(ctx);
		details = {
			...details,
			...selectedModel(ctx),
			cwd: displayCwd(ctx.cwd),
		};
		ctx.ui.setTitle(`Recode — ${basename(ctx.cwd) || "session"}`);
		installHeader(ctx);
	});

	pi.on("before_agent_start", (_event, ctx) => {
		if (ctx.mode !== "tui" || !visible) return;
		visible = false;
		installHeader(ctx);
	});

	pi.on("model_select", (event, ctx) => {
		details = {
			...details,
			model: event.model.id,
			provider: event.model.provider,
			cwd: displayCwd(ctx.cwd),
		};
		if (ctx.mode === "tui" && visible) installHeader(ctx);
	});
}
