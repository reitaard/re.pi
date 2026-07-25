import {
	createModels,
	type FauxProviderHandle,
	fauxAssistantMessage,
	fauxProvider,
	fauxToolCall,
	type RegisterFauxProviderOptions,
} from "@earendil-works/pi-ai";
import { getModel } from "@earendil-works/pi-ai/compat";
import { describe, expect, it } from "vitest";
import { RecodeAgentHarness } from "../../src/harness/recode-agent-harness.ts";
import { RECODE_HARNESS_JOURNAL_CUSTOM_TYPE } from "../../src/harness/recode-harness-journal.ts";
import { InMemorySessionStorage } from "../../src/harness/session/memory-storage.ts";
import { Session } from "../../src/harness/session/session.ts";
import { calculateTool } from "../utils/calculate.ts";

const models = createModels();
let fauxCount = 0;

function newFaux(options: RegisterFauxProviderOptions = {}): FauxProviderHandle {
	const faux = fauxProvider({ provider: `recode-journal-faux-${++fauxCount}`, ...options });
	models.setProvider(faux.provider);
	return faux;
}

describe("Recode durable harness journal", () => {
	it("persists inspectable operation, turn, and tool boundaries", async () => {
		const registration = newFaux();
		registration.setResponses([
			fauxAssistantMessage(fauxToolCall("calculate", { expression: "2 + 2" }, { id: "call-journal" }), {
				stopReason: "toolUse",
			}),
			fauxAssistantMessage("4"),
		]);
		const harness = new RecodeAgentHarness({
			models,
			session: new Session(new InMemorySessionStorage()),
			model: registration.getModel(),
			tools: [calculateTool],
		});

		await harness.prompt("calculate");

		const records = (await harness.getJournalEntries()).map((entry) => entry.record);
		expect(records.map((record) => record.event)).toEqual([
			"operation_started",
			"turn_started",
			"tool_started",
			"tool_finished",
			"turn_finished",
			"turn_started",
			"turn_finished",
			"operation_finished",
		]);
		expect(records.find((record) => record.event === "tool_started")).toMatchObject({
			toolCallId: "call-journal",
			toolName: "calculate",
		});
		expect(records.at(-1)).toMatchObject({ event: "operation_finished", outcome: "success" });
	});

	it("marks unfinished durable work interrupted without replaying it", async () => {
		const operationId = "operation-before-restart";
		const turnId = "turn-before-restart";
		const session = new Session(new InMemorySessionStorage());
		await session.appendCustomEntry(RECODE_HARNESS_JOURNAL_CUSTOM_TYPE, {
			version: 1,
			event: "operation_started",
			operationId,
			operation: "prompt",
		});
		await session.appendCustomEntry(RECODE_HARNESS_JOURNAL_CUSTOM_TYPE, {
			version: 1,
			event: "turn_started",
			operationId,
			turnId,
		});
		await session.appendCustomEntry(RECODE_HARNESS_JOURNAL_CUSTOM_TYPE, {
			version: 1,
			event: "tool_started",
			operationId,
			turnId,
			toolCallId: "uncertain-tool",
			toolName: "calculate",
		});
		const harness = new RecodeAgentHarness({
			models,
			session,
			model: getModel("anthropic", "claude-sonnet-4-5"),
		});

		await expect(harness.recover()).resolves.toEqual({
			operationsInterrupted: 1,
			turnsInterrupted: 1,
			toolsInterrupted: 1,
		});

		const records = (await harness.getJournalEntries()).map((entry) => entry.record);
		expect(records.slice(-3).map((record) => record.event)).toEqual([
			"tool_interrupted",
			"turn_interrupted",
			"operation_interrupted",
		]);
	});
});
