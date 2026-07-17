import { type Component, Loader, type TUI } from "@reitaard/repi-tui";
import type { WorkingIndicatorOptions } from "../../../core/extensions/index.ts";
import { theme } from "../theme/theme.ts";
import { CountdownTimer } from "./countdown-timer.ts";
import { keyText } from "./keybinding-hints.ts";
import { createRecodeMagicIndicator, recodeSpinner, selectRecodeSpinnerVerb } from "./recode-magic-indicator.ts";

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
	private elapsedIntervalId: ReturnType<typeof setInterval> | undefined;
	private readonly startedAt: number;
	private usesCustomIndicator: boolean;
	private workingMessage: string;

	constructor(ui: TUI, message: string, indicator?: WorkingIndicatorOptions) {
		super(
			"working",
			ui,
			recodeSpinner,
			(text) => text,
			indicator ? theme.fg("muted", message) : recodeSpinner(formatElapsedRuntime(0)),
			indicator ?? createRecodeMagicIndicator(selectRecodeSpinnerVerb()),
		);
		this.startedAt = Date.now();
		this.usesCustomIndicator = indicator !== undefined;
		this.workingMessage = message;
		if (!this.usesCustomIndicator) {
			this.startElapsedTimer();
		}
	}

	setGenerating(): void {
		// The default indicator already owns the seamless verb-to-encrypted sequence.
	}

	applyIndicator(indicator?: WorkingIndicatorOptions): void {
		this.usesCustomIndicator = indicator !== undefined;
		if (indicator) {
			this.stopElapsedTimer();
			super.setIndicator(indicator);
			super.setMessage(theme.fg("muted", this.workingMessage));
		} else {
			super.setIndicator(createRecodeMagicIndicator(selectRecodeSpinnerVerb()));
			this.startElapsedTimer();
		}
	}

	override setMessage(message: string): void {
		this.workingMessage = message;
		if (this.usesCustomIndicator) {
			super.setMessage(theme.fg("muted", message));
		}
	}

	override dispose(): void {
		this.stopElapsedTimer();
		super.dispose();
	}

	private startElapsedTimer(): void {
		this.stopElapsedTimer();
		const updateElapsed = () => {
			super.setMessage(recodeSpinner(formatElapsedRuntime(Date.now() - this.startedAt)));
		};
		updateElapsed();
		this.elapsedIntervalId = setInterval(updateElapsed, 1000);
	}

	private stopElapsedTimer(): void {
		if (this.elapsedIntervalId) {
			clearInterval(this.elapsedIntervalId);
			this.elapsedIntervalId = undefined;
		}
	}
}

function formatElapsedRuntime(elapsedMs: number): string {
	const totalSeconds = Math.max(0, Math.floor(elapsedMs / 1000));
	const hours = Math.floor(totalSeconds / 3600);
	const minutes = Math.floor((totalSeconds % 3600) / 60);
	const seconds = totalSeconds % 60;

	if (hours > 0) return `· ${hours}h ${minutes.toString().padStart(2, "0")}m ${seconds.toString().padStart(2, "0")}s`;
	if (minutes > 0) return `· ${minutes}m ${seconds.toString().padStart(2, "0")}s`;
	return `· ${seconds}s`;
}

export class RetryStatusIndicator extends StatusIndicator {
	private countdown: CountdownTimer | undefined;

	constructor(ui: TUI, attempt: number, maxAttempts: number, delayMs: number) {
		const retryMessage = (seconds: number) =>
			`Retrying (${attempt}/${maxAttempts}) in ${seconds}s... (${keyText("app.interrupt")} to cancel)`;
		super("retry", ui, recodeSpinner, (text) => theme.fg("muted", text), retryMessage(Math.ceil(delayMs / 1000)));
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
		super("compaction", ui, recodeSpinner, (text) => theme.fg("muted", text), label);
	}
}

export class BranchSummaryStatusIndicator extends StatusIndicator {
	constructor(ui: TUI) {
		super(
			"branchSummary",
			ui,
			recodeSpinner,
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
