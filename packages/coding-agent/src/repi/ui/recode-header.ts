import type { Component } from "@earendil-works/pi-tui";
import { truncateToWidth, visibleWidth } from "@earendil-works/pi-tui";
import chalk from "chalk";
import type { Theme } from "../../modes/interactive/theme/theme.ts";
import { workerForeground } from "./recode-worker-indicator.ts";

export interface RecodeWorkerHeaderState {
	workerId: string;
	workerName: string;
	status: string;
	memoryDocumentCount: number;
	sessionCount: number;
	turnCount: number;
	evaluationCount: number;
}

export interface RecodeHeaderDetails {
	model: string;
	provider: string;
	cwd: string;
	worker?: RecodeWorkerHeaderState;
}

type RecodeHeaderLayout = {
	mode: "compact" | "stacked" | "wide";
	leftWidth: number;
	rightWidth: number;
};

const WORDMARK_LETTERS = [
	["▄▀▀▀▀▀", "█     ", "▀▀▀▀▀▀"],
	["█▀▀▀▀█", "█    █", "▀▀▀▀▀▀"],
	["█▀▀▀▀▄", "█    █", "▀▀▀▀▀ "],
	["█▀▀▀▀▀", "█▀▀▀  ", "▀▀▀▀▀▀"],
] as const;
const MIN_STACKED_WIDTH = 48;
const MIN_WIDE_WIDTH = 72;
const WIDE_LEFT_WIDTH = 32;
const WELCOME_BOX_HEIGHT = 9;
const BRAND_TEXT_PALETTE = ["#FF3478", "#FF8E71", "#EFFFBD"] as const;
const BRAND_LINE_PALETTE = ["#025D7A", "#00B6B9", "#55DC99", "#B2FF7B"] as const;

function padCell(text: string, width: number): string {
	const truncated = truncateToWidth(text, width, "");
	return truncated + " ".repeat(Math.max(0, width - visibleWidth(truncated)));
}

function centerCell(text: string, width: number): string {
	const truncated = truncateToWidth(text, width, "");
	const remaining = Math.max(0, width - visibleWidth(truncated));
	const left = Math.floor(remaining / 2);
	return " ".repeat(left) + truncated + " ".repeat(remaining - left);
}

function paletteColor(palette: readonly string[], index: number, text: string): string {
	return chalk.hex(palette[Math.min(index, palette.length - 1)]!)(text);
}

function textColor(index: number, text: string): string {
	return paletteColor(BRAND_TEXT_PALETTE, index, text);
}

function lineColor(index: number, text: string): string {
	return paletteColor(BRAND_LINE_PALETTE, index, text);
}

function gradientRule(text: string): string {
	const characters = [...text];
	return characters
		.map((character, index) =>
			lineColor(Math.floor((index * BRAND_LINE_PALETTE.length) / Math.max(1, characters.length)), character),
		)
		.join("");
}

function gradientText(text: string): string {
	const characters = [...text];
	return characters
		.map((character, index) =>
			textColor(Math.floor((index * BRAND_TEXT_PALETTE.length) / Math.max(1, characters.length)), character),
		)
		.join("");
}

function workerStatus(text: string, theme: Theme): string {
	const normalized = text.trim().toLowerCase();
	if (["failed", "error", "unavailable", "timeout", "cancelled"].includes(normalized)) {
		return theme.bold(theme.fg("error", text));
	}
	if (["ready", "completed", "healthy"].includes(normalized)) {
		return theme.bold(theme.fg("success", text));
	}
	return theme.bold(theme.fg("warning", text));
}

function metric(value: number, theme: Theme): string {
	return theme.bold(theme.fg("accent", String(value)));
}

function renderWordmarkRow(row: number): string {
	return WORDMARK_LETTERS.map((letter, index) => textColor(index % 3, letter[row]!)).join(" ");
}

function calculateLayout(width: number): RecodeHeaderLayout {
	if (width < MIN_STACKED_WIDTH) return { mode: "compact", leftWidth: width, rightWidth: 0 };
	if (width < MIN_WIDE_WIDTH) return { mode: "stacked", leftWidth: width - 2, rightWidth: 0 };
	const innerWidth = width - 2;
	const leftWidth = Math.min(WIDE_LEFT_WIDTH, Math.max(28, innerWidth - 37));
	return {
		mode: "wide",
		leftWidth,
		rightWidth: innerWidth - leftWidth - 1,
	};
}

export class RecodeHeader implements Component {
	private readonly version: string;
	private readonly getDetails: () => RecodeHeaderDetails;
	private readonly theme: Theme;

	constructor(version: string, getDetails: () => RecodeHeaderDetails, theme: Theme) {
		this.version = version;
		this.getDetails = getDetails;
		this.theme = theme;
	}

	invalidate(): void {}

	render(width: number): string[] {
		if (width <= 0) return [];
		const layout = calculateLayout(width);
		if (layout.mode === "compact") return [this.renderCompact(width)];
		if (layout.mode === "stacked") return this.renderStacked(width, layout.leftWidth);
		return this.renderWide(width, layout.leftWidth, layout.rightWidth);
	}

	private renderCompact(width: number): string {
		return this.theme.bold(gradientText(truncateToWidth(`re™ CODE v${this.version} · / commands`, width, "")));
	}

	private renderTopBorder(width: number): string {
		const title = ` re.pi v${this.version} `;
		const styledTitle = ` ${this.theme.bold(textColor(0, "re.pi"))} ${textColor(2, `v${this.version}`)} `;
		return lineColor(0, "╭") + styledTitle + gradientRule(`${"─".repeat(Math.max(0, width - visibleWidth(title) - 2))}╮`);
	}

	private renderBottomBorder(width: number): string {
		return gradientRule(`╰${"─".repeat(Math.max(0, width - 2))}╯`);
	}

	private renderWide(width: number, leftWidth: number, rightWidth: number): string[] {
		const details = this.getDetails();
		const model = details.provider === "unknown" ? details.model : `${details.model} · ${details.provider}`;
		const workerLabel = (text: string): string =>
			details.worker ? workerForeground(details.worker.workerId, "text", text, this.theme) : text;
		const leftRows = [
			this.theme.bold(this.theme.fg("text", " Welcome to re™")),
			"",
			centerCell(renderWordmarkRow(0), leftWidth),
			centerCell(renderWordmarkRow(1), leftWidth),
			centerCell(renderWordmarkRow(2), leftWidth),
			this.theme.fg("muted", ` ${model}`),
			this.theme.fg("dim", ` ${details.cwd}`),
		];
		const rightRows = details.worker
			? [
					this.theme.bold(
						workerForeground(
							details.worker.workerId,
							"identity",
							` Direct chat · ${details.worker.workerName}`,
							this.theme,
						),
					),
					`${workerLabel(" Health       ")}${workerStatus(details.worker.status, this.theme)}`,
					`${workerLabel(" Memory       ")}${metric(details.worker.memoryDocumentCount, this.theme)}${this.theme.fg("dim", " documents")}`,
					`${workerLabel(" Progress     ")}${metric(details.worker.sessionCount, this.theme)}${this.theme.fg("dim", " sessions · ")}${metric(details.worker.turnCount, this.theme)}${this.theme.fg("dim", " turns")}`,
					`${workerLabel(" Evaluations  ")}${metric(details.worker.evaluationCount, this.theme)}${this.theme.fg("dim", " recorded")}`,
					this.theme.fg("dim", " Enter sends · Esc returns to Aizen"),
					"",
				]
			: [
					this.theme.bold(this.theme.fg("accent", " Tips for getting started")),
					this.theme.fg("muted", " Type / for commands · ! for bash"),
					this.theme.fg("dim", " Press Ctrl+O to expand startup help"),
					"",
					this.theme.bold(this.theme.fg("borderAccent", " Session")),
					this.theme.fg("muted", " Fresh session · ready"),
					this.theme.fg("dim", " Type a message to begin"),
				];
		const rows = [this.renderTopBorder(width)];
		for (let row = 0; row < WELCOME_BOX_HEIGHT - 2; row++) {
			rows.push(
				lineColor(0, "│") +
					padCell(leftRows[row]!, leftWidth) +
					lineColor(1, "│") +
					padCell(rightRows[row]!, rightWidth) +
					lineColor(3, "│"),
			);
		}
		rows.push(this.renderBottomBorder(width));
		return rows;
	}

	private renderStacked(width: number, contentWidth: number): string[] {
		const details = this.getDetails();
		const model = details.provider === "unknown" ? details.model : `${details.model} · ${details.provider}`;
		return [
			this.renderTopBorder(width),
			lineColor(0, "│") + centerCell(renderWordmarkRow(0), contentWidth) + lineColor(3, "│"),
			lineColor(0, "│") + centerCell(renderWordmarkRow(1), contentWidth) + lineColor(3, "│"),
			lineColor(0, "│") + centerCell(renderWordmarkRow(2), contentWidth) + lineColor(3, "│"),
			lineColor(0, "│") + padCell(this.theme.fg("muted", ` ${model}`), contentWidth) + lineColor(3, "│"),
			lineColor(0, "│") + padCell(this.theme.fg("dim", ` ${details.cwd}`), contentWidth) + lineColor(3, "│"),
			lineColor(0, "│") +
				padCell(this.theme.fg("accent", " / commands · ! bash · Ctrl+O help"), contentWidth) +
				lineColor(3, "│"),
			lineColor(0, "│") + " ".repeat(contentWidth) + lineColor(3, "│"),
			this.renderBottomBorder(width),
		];
	}
}
