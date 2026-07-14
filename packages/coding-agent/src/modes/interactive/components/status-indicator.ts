import { type Component, Loader, type TUI } from "@earendil-works/pi-tui";
import type { WorkingIndicatorOptions } from "../../../core/extensions/index.ts";
import { theme } from "../theme/theme.ts";
import { CountdownTimer } from "./countdown-timer.ts";
import { keyText } from "./keybinding-hints.ts";
import { createRecodeGeneratingTransition, createRecodeLoaderIndicator } from "./recode-magic-indicator.ts";

export type StatusIndicatorKind = "working" | "retry" | "compaction" | "branchSummary";

export class StatusIndicator extends Loader {
	readonly kind: StatusIndicatorKind;

	constructor(
		kind: StatusIndicatorKind,
		ui: TUI,
		spinnerColorFn: (str: string) => string,
		messageColorFn: (str: string) => string,
		message: string,
		indicator?: WorkingIndicatorOptions,
	) {
		super(ui, spinnerColorFn, messageColorFn, message, indicator);
		this.kind = kind;
	}

	dispose(): void {
		this.stop();
	}
}

export class WorkingStatusIndicator extends StatusIndicator {
	private generating = false;
	private transitionTimer: NodeJS.Timeout | undefined;
	private usesCustomIndicator: boolean;
	private workingMessage: string;

	constructor(ui: TUI, message: string, indicator?: WorkingIndicatorOptions) {
		super(
			"working",
			ui,
			(spinner) => theme.fg("borderAccent", spinner),
			(text) => theme.fg("muted", text),
			message,
			indicator ?? createRecodeLoaderIndicator(),
		);
		this.usesCustomIndicator = indicator !== undefined;
		this.workingMessage = message;
	}

	setGenerating(): void {
		if (this.generating || this.usesCustomIndicator) return;
		this.generating = true;
		const transition = createRecodeGeneratingTransition();
		super.setMessage("");
		super.setIndicator(transition.indicator);
		this.transitionTimer = setTimeout(() => {
			this.transitionTimer = undefined;
			super.setIndicator(createRecodeLoaderIndicator());
			super.setMessage("Generating...");
		}, transition.durationMs);
	}

	applyIndicator(indicator?: WorkingIndicatorOptions): void {
		this.clearTransitionTimer();
		this.generating = false;
		this.usesCustomIndicator = indicator !== undefined;
		super.setIndicator(indicator ?? createRecodeLoaderIndicator());
		super.setMessage(this.workingMessage);
	}

	override setMessage(message: string): void {
		this.workingMessage = message;
		if (!this.generating) {
			super.setMessage(message);
		}
	}

	override dispose(): void {
		this.clearTransitionTimer();
		super.dispose();
	}

	private clearTransitionTimer(): void {
		if (this.transitionTimer) {
			clearTimeout(this.transitionTimer);
			this.transitionTimer = undefined;
		}
	}
}

export class RetryStatusIndicator extends StatusIndicator {
	private countdown: CountdownTimer | undefined;

	constructor(ui: TUI, attempt: number, maxAttempts: number, delayMs: number) {
		const retryMessage = (seconds: number) =>
			`Retrying (${attempt}/${maxAttempts}) in ${seconds}s... (${keyText("app.interrupt")} to cancel)`;
		super(
			"retry",
			ui,
			(spinner) => theme.fg("warning", spinner),
			(text) => theme.fg("muted", text),
			retryMessage(Math.ceil(delayMs / 1000)),
		);
		this.countdown = new CountdownTimer(
			delayMs,
			ui,
			(seconds) => {
				this.setMessage(retryMessage(seconds));
			},
			() => {
				this.countdown = undefined;
			},
		);
	}

	override dispose(): void {
		this.countdown?.dispose();
		this.countdown = undefined;
		super.dispose();
	}
}

export type CompactionStatusReason = "manual" | "threshold" | "overflow";

export class CompactionStatusIndicator extends StatusIndicator {
	constructor(ui: TUI, reason: CompactionStatusReason) {
		const cancelHint = `(${keyText("app.interrupt")} to cancel)`;
		const label =
			reason === "manual"
				? `Compacting context... ${cancelHint}`
				: `${reason === "overflow" ? "Context overflow detected, " : ""}Auto-compacting... ${cancelHint}`;
		super(
			"compaction",
			ui,
			(spinner) => theme.fg("accent", spinner),
			(text) => theme.fg("muted", text),
			label,
		);
	}
}

export class BranchSummaryStatusIndicator extends StatusIndicator {
	constructor(ui: TUI) {
		super(
			"branchSummary",
			ui,
			(spinner) => theme.fg("accent", spinner),
			(text) => theme.fg("muted", text),
			`Summarizing branch... (${keyText("app.interrupt")} to cancel)`,
		);
	}
}

export class IdleStatus implements Component {
	invalidate(): void {
		// No cached state to invalidate.
	}

	render(width: number): string[] {
		const emptyLine = " ".repeat(width);
		return [emptyLine, emptyLine];
	}
}
