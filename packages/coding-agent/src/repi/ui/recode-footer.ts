import { isAbsolute, relative, resolve, sep } from "node:path";
import type { ThinkingLevel } from "@earendil-works/pi-agent-core";
import type { Api, Model, ModelThinkingLevel, Usage } from "@earendil-works/pi-ai";
import { type Component, truncateToWidth, visibleWidth } from "@earendil-works/pi-tui";
import type { ContextUsage } from "../../core/extensions/types.ts";
import type { ReadonlyFooterDataProvider } from "../../core/footer-data-provider.ts";
import type { ModelRegistry } from "../../core/model-registry.ts";
import type { ReadonlySessionManager } from "../../core/session-manager.ts";
import type { Theme } from "../../modes/interactive/theme/theme.ts";
import { formatRecodeThinkingLevel } from "./recode-thinking-label.ts";

const SMART_CONTEXT_COMPACT_THRESHOLD_PERCENT = 40;
const MODEL_THINKING_LEVEL_ORDER: readonly ModelThinkingLevel[] = [
	"minimal",
	"low",
	"medium",
	"high",
	"xhigh",
	"max",
];

interface UsageTotals {
	input: number;
	output: number;
	cacheRead: number;
	cacheWrite: number;
	cost: number;
	latestCacheHitRate?: number;
}

export interface RecodeFooterState {
	cwd: string;
	sessionManager: ReadonlySessionManager;
	modelRegistry: ModelRegistry;
	model: Model<Api> | undefined;
	thinkingLevel: ThinkingLevel;
	getContextUsage: () => ContextUsage | undefined;
}

function sanitizeStatusText(text: string): string {
	return text
		.replace(/[\r\n\t]/g, " ")
		.replace(/ +/g, " ")
		.trim();
}

export function formatRecodeTokens(count: number): string {
	if (count < 1000) return count.toString();
	if (count < 10_000) return `${(count / 1000).toFixed(1)}k`;
	if (count < 1_000_000) return `${Math.round(count / 1000)}k`;
	if (count < 10_000_000) return `${(count / 1_000_000).toFixed(1)}M`;
	return `${Math.round(count / 1_000_000)}M`;
}

export function formatRecodeFooterCwd(cwd: string, home: string | undefined): string {
	if (!home) return cwd;
	const resolvedCwd = resolve(cwd);
	const resolvedHome = resolve(home);
	const relativeToHome = relative(resolvedHome, resolvedCwd);
	const isInsideHome =
		relativeToHome === "" ||
		(relativeToHome !== ".." && !relativeToHome.startsWith(`..${sep}`) && !isAbsolute(relativeToHome));
	if (!isInsideHome) return cwd;
	return relativeToHome === "" ? "~" : `~${sep}${relativeToHome}`;
}

function addUsage(totals: UsageTotals, usage: Usage): void {
	totals.input += usage.input;
	totals.output += usage.output;
	totals.cacheRead += usage.cacheRead;
	totals.cacheWrite += usage.cacheWrite;
	totals.cost += usage.cost.total;
	const promptTokens = usage.input + usage.cacheRead + usage.cacheWrite;
	totals.latestCacheHitRate = promptTokens > 0 ? (usage.cacheRead / promptTokens) * 100 : undefined;
}

function collectUsage(sessionManager: ReadonlySessionManager): UsageTotals {
	const totals: UsageTotals = { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, cost: 0 };
	for (const entry of sessionManager.getEntries()) {
		if (entry.type === "message" && entry.message.role === "assistant") {
			addUsage(totals, entry.message.usage);
		} else if (entry.type === "message" && entry.message.role === "toolResult" && entry.message.usage) {
			addUsage(totals, entry.message.usage);
		} else if ((entry.type === "branch_summary" || entry.type === "compaction") && entry.usage) {
			addUsage(totals, entry.usage);
		}
	}
	return totals;
}

function availableThinkingLevels(model: Model<Api>): ThinkingLevel[] {
	if (!model.reasoning) return ["off"];
	if (!model.thinkingLevelMap) return ["off", ...MODEL_THINKING_LEVEL_ORDER];
	return [
		"off",
		...MODEL_THINKING_LEVEL_ORDER.filter((level) => model.thinkingLevelMap?.[level] !== null),
	];
}

function ansiForeground(text: string, hex: string, ansi256: number, theme: Theme): string {
	const ansi =
		theme.getColorMode() === "truecolor"
			? `\x1b[38;2;${Number.parseInt(hex.slice(1, 3), 16)};${Number.parseInt(hex.slice(3, 5), 16)};${Number.parseInt(hex.slice(5, 7), 16)}m`
			: `\x1b[38;5;${ansi256}m`;
	return `${ansi}${text}\x1b[39m`;
}

function footerForeground(text: string, theme: Theme): string {
	return theme.name === "light"
		? ansiForeground(text, "#0F766E", 30, theme)
		: ansiForeground(text, "#00B6B9", 37, theme);
}

export class RecodeFooter implements Component {
	private readonly getState: () => RecodeFooterState;
	private readonly footerData: ReadonlyFooterDataProvider;
	private readonly theme: Theme;

	constructor(getState: () => RecodeFooterState, footerData: ReadonlyFooterDataProvider, theme: Theme) {
		this.getState = getState;
		this.footerData = footerData;
		this.theme = theme;
	}

	invalidate(): void {}

	render(width: number): string[] {
		const state = this.getState();
		const usage = collectUsage(state.sessionManager);
		const contextUsage = state.getContextUsage();
		const contextPercentValue = contextUsage?.percent ?? 0;
		const contextPercent = contextUsage?.percent == null ? "?" : contextPercentValue.toFixed(1);
		const contextTokens = contextUsage?.tokens == null ? undefined : formatRecodeTokens(contextUsage.tokens);

		let pwd = formatRecodeFooterCwd(state.cwd, process.env.HOME || process.env.USERPROFILE);
		const branch = this.footerData.getGitBranch();
		if (branch) pwd = `${pwd} (${branch})`;
		const sessionName = state.sessionManager.getSessionName();
		if (sessionName) pwd = `${pwd} • ${sessionName}`;

		const statsParts: string[] = [];
		if (usage.input) statsParts.push(this.theme.fg("accent", `↑${formatRecodeTokens(usage.input)}`));
		if (usage.output) statsParts.push(this.theme.fg("accent", `↓${formatRecodeTokens(usage.output)}`));
		if (usage.cacheRead) statsParts.push(`R${formatRecodeTokens(usage.cacheRead)}`);
		if (usage.cacheWrite) statsParts.push(`W${formatRecodeTokens(usage.cacheWrite)}`);
		if ((usage.cacheRead > 0 || usage.cacheWrite > 0) && usage.latestCacheHitRate !== undefined) {
			statsParts.push(`CH${usage.latestCacheHitRate.toFixed(1)}%`);
		}

		const usingSubscription = state.model ? state.modelRegistry.isUsingOAuth(state.model) : false;
		if (usage.cost || usingSubscription) {
			statsParts.push(`$${usage.cost.toFixed(3)}${usingSubscription ? " (sub)" : ""}`);
		}

		const compactHint = contextPercentValue >= SMART_CONTEXT_COMPACT_THRESHOLD_PERCENT ? " (compact?)" : "";
		const contextText =
			contextPercent === "?"
				? "ctx ?"
				: `ctx ${contextTokens ? `${contextTokens} ` : ""}${contextPercent}%${compactHint}`;
		statsParts.push(contextPercent === "?" ? footerForeground(contextText, this.theme) : this.theme.fg("accent", contextText));
		let statsLeft = statsParts.join(" ");
		let statsLeftWidth = visibleWidth(statsLeft);
		if (statsLeftWidth > width) {
			statsLeft = truncateToWidth(statsLeft, width, "...");
			statsLeftWidth = visibleWidth(statsLeft);
		}

		const modelName = state.model?.id ?? "no-model";
		let rightSideWithoutProvider = modelName;
		if (state.model?.reasoning) {
			const thinkingLabel = formatRecodeThinkingLevel(
				state.thinkingLevel,
				availableThinkingLevels(state.model),
			);
			rightSideWithoutProvider = `${modelName} • thinking ${thinkingLabel}`;
		}

		let rightSide = rightSideWithoutProvider;
		if (this.footerData.getAvailableProviderCount() > 1 && state.model) {
			rightSide = `(${state.model.provider}) ${rightSideWithoutProvider}`;
			if (statsLeftWidth + 2 + visibleWidth(rightSide) > width) rightSide = rightSideWithoutProvider;
		}

		const rightSideWidth = visibleWidth(rightSide);
		let statsLine: string;
		if (statsLeftWidth + 2 + rightSideWidth <= width) {
			statsLine = statsLeft + " ".repeat(width - statsLeftWidth - rightSideWidth) + rightSide;
		} else {
			const availableForRight = width - statsLeftWidth - 2;
			if (availableForRight > 0) {
				const truncatedRight = truncateToWidth(rightSide, availableForRight, "");
				statsLine = statsLeft + " ".repeat(Math.max(0, width - statsLeftWidth - visibleWidth(truncatedRight))) + truncatedRight;
			} else {
				statsLine = statsLeft;
			}
		}

		const remainder = statsLine.slice(statsLeft.length);
		const lines = [
			truncateToWidth(footerForeground(pwd, this.theme), width, footerForeground("...", this.theme)),
			footerForeground(statsLeft, this.theme) + footerForeground(remainder, this.theme),
		];

		const extensionStatuses = this.footerData.getExtensionStatuses();
		if (extensionStatuses.size > 0) {
			const statusLine = Array.from(extensionStatuses.entries())
				.sort(([a], [b]) => a.localeCompare(b))
				.map(([, text]) => sanitizeStatusText(text))
				.join(" ");
			lines.push(truncateToWidth(statusLine, width, footerForeground("...", this.theme)));
		}
		return lines;
	}
}
