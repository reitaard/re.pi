import { homedir } from "node:os";
import { basename } from "node:path";
import type { ExtensionAPI, ExtensionContext } from "../../core/extensions/types.ts";
import { SettledStatus, type SettledOutcome } from "../../modes/interactive/components/status-indicator.ts";
import { getActiveWorkerHeaderState } from "../delegation/worker-header-state.ts";
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
		.some((entry) => entry.type === "message" || entry.type === "custom" || entry.type === "custom_message");
}

function formatElapsedRuntime(startedAt: number): string {
	const totalSeconds = Math.max(0, Math.floor((Date.now() - startedAt) / 1000));
	const hours = Math.floor(totalSeconds / 3600);
	const minutes = Math.floor((totalSeconds % 3600) / 60);
	const seconds = totalSeconds % 60;
	if (hours > 0) return `· ${hours}h ${minutes.toString().padStart(2, "0")}m ${seconds.toString().padStart(2, "0")}s`;
	if (minutes > 0) return `· ${minutes}m ${seconds.toString().padStart(2, "0")}s`;
	return `· ${seconds}s`;
}

export function repiProductUi(pi: ExtensionAPI): void {
	const version = process.env.REPI_VERSION ?? "development";
	let visible = true;
	let details: RecodeHeaderDetails = {
		model: "No model selected",
		provider: "unknown",
		cwd: displayCwd(process.cwd()),
	};
	let runStartedAt = 0;
	let settledOutcome: SettledOutcome = "completed";

	const installHeader = (ctx: ExtensionContext): void => {
		ctx.ui.setHeader(
			(_tui, theme) =>
				new RecodeHeader(
					version,
					() => visible || getActiveWorkerHeaderState() !== undefined,
					() => ({ ...details, worker: getActiveWorkerHeaderState() }),
					theme,
				),
		);
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
		ctx.ui.setWidget("repi-settled-status", undefined, { placement: "aboveEditor" });
		installHeader(ctx);
	});

	pi.on("before_agent_start", (_event, ctx) => {
		if (ctx.mode !== "tui" || !visible) return;
		visible = false;
		installHeader(ctx);
	});

	pi.on("agent_start", (_event, ctx) => {
		if (ctx.mode !== "tui") return;
		runStartedAt = Date.now();
		settledOutcome = "completed";
		ctx.ui.setWidget("repi-settled-status", undefined, { placement: "aboveEditor" });
	});

	pi.on("message_end", (event) => {
		if (event.message.role !== "assistant") return;
		if (event.message.stopReason === "aborted") settledOutcome = "cancelled";
		if (event.message.stopReason === "error") settledOutcome = "failed";
	});

	pi.on("agent_settled", (_event, ctx) => {
		if (ctx.mode !== "tui" || runStartedAt === 0) return;
		const elapsed = formatElapsedRuntime(runStartedAt);
		ctx.ui.setWidget(
			"repi-settled-status",
			() => new SettledStatus(settledOutcome, elapsed),
			{ placement: "aboveEditor" },
		);
	});

	pi.on("model_select", (event, ctx) => {
		details = {
			...details,
			model: event.model.id,
			provider: event.model.provider,
			cwd: displayCwd(ctx.cwd),
		};
		if (ctx.mode === "tui" && (visible || getActiveWorkerHeaderState())) installHeader(ctx);
	});
}
