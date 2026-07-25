import type { AssistantMessage, ImageContent } from "@earendil-works/pi-ai";
import type { AgentEvent } from "../types.ts";
import { AgentHarness as PiAgentHarness } from "./agent-harness.ts";
import {
	RecodeHarnessJournal,
	type RecodeHarnessJournalEntry,
	type RecodeHarnessOperation,
	type RecodeHarnessOperationOutcome,
	type RecodeHarnessRecoveryResult,
} from "./recode-harness-journal.ts";
import type {
	AgentHarnessOptions,
	AgentHarnessTool,
	CompactResult,
	NavigateTreeResult,
	PromptTemplate,
	Skill,
} from "./types.ts";
import { AgentHarnessError, toError } from "./types.ts";

function outcomeFromAssistant(message: AssistantMessage): RecodeHarnessOperationOutcome {
	if (message.stopReason === "error") return "error";
	if (message.stopReason === "aborted") return "aborted";
	return "success";
}

/**
 * Recode product harness layered over the current Pi harness.
 *
 * Upstream owns the agent loop and operation semantics. Recode adds a durable,
 * model-invisible journal around public operations and records turn/tool events
 * through the public subscription surface.
 */
export class RecodeAgentHarness<
	TContext extends object | undefined = undefined,
	TSkill extends Skill = Skill,
	TPromptTemplate extends PromptTemplate = PromptTemplate,
	TTool extends AgentHarnessTool<TContext> = AgentHarnessTool<TContext>,
> extends PiAgentHarness<TContext, TSkill, TPromptTemplate, TTool> {
	private readonly journal: RecodeHarnessJournal;

	constructor(options: AgentHarnessOptions<TContext, TSkill, TPromptTemplate, TTool>) {
		super(options);
		this.journal = new RecodeHarnessJournal(options.session);
		this.subscribe((event) => {
			if (
				event.type === "turn_start" ||
				event.type === "turn_end" ||
				event.type === "tool_execution_start" ||
				event.type === "tool_execution_end"
			) {
				return this.journal.recordAgentEvent(event as AgentEvent);
			}
		});
	}

	async recover(): Promise<RecodeHarnessRecoveryResult> {
		return this.journal.recover();
	}

	async getJournalEntries(): Promise<RecodeHarnessJournalEntry[]> {
		return this.journal.getEntries();
	}

	override async prompt(text: string, options?: { images?: ImageContent[] }): Promise<AssistantMessage> {
		return this.runJournaledOperation("prompt", () => super.prompt(text, options), outcomeFromAssistant);
	}

	override async skill(name: string, additionalInstructions?: string): Promise<AssistantMessage> {
		return this.runJournaledOperation(
			"skill",
			() => super.skill(name, additionalInstructions),
			outcomeFromAssistant,
		);
	}

	override async promptFromTemplate(name: string, args: string[] = []): Promise<AssistantMessage> {
		return this.runJournaledOperation(
			"prompt_template",
			() => super.promptFromTemplate(name, args),
			outcomeFromAssistant,
		);
	}

	override async compact(customInstructions?: string): Promise<CompactResult> {
		return this.runJournaledOperation("compaction", () => super.compact(customInstructions));
	}

	override async navigateTree(
		targetId: string,
		options?: { summarize?: boolean; customInstructions?: string; replaceInstructions?: boolean; label?: string },
	): Promise<NavigateTreeResult> {
		return this.runJournaledOperation(
			"branch_summary",
			() => super.navigateTree(targetId, options),
			(result) => (result.cancelled ? "cancelled" : "success"),
		);
	}

	private async runJournaledOperation<T>(
		operation: RecodeHarnessOperation,
		work: () => Promise<T>,
		outcome: (result: T) => RecodeHarnessOperationOutcome = () => "success",
	): Promise<T> {
		await this.journal.beginOperation(operation);
		try {
			const result = await work();
			await this.journal.finishOperation(outcome(result));
			return result;
		} catch (error) {
			try {
				await this.journal.interruptOperation(error);
			} catch (journalError) {
				throw new AgentHarnessError(
					"session",
					"Agent operation and durable journal finalization both failed",
					new AggregateError([toError(error), toError(journalError)]),
				);
			}
			throw error;
		}
	}
}
