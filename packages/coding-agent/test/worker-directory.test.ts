import { createModels, fauxAssistantMessage, fauxProvider } from "@reitaard/repi-ai";
import { describe, expect, it } from "vitest";
import type { NamedWorkerDefinition } from "../src/core/delegation/named-worker.ts";
import { WorkerDirectory } from "../src/core/delegation/worker-directory.ts";
import { createWorkerControlTools } from "../src/core/delegation/worker-tools.ts";

let providerCount = 0;

function createFaux() {
	const registration = fauxProvider({ provider: `worker-directory-test-${++providerCount}` });
	const models = createModels();
	models.setProvider(registration.provider);
	return { registration, models };
}

function workers(): NamedWorkerDefinition[] {
	return [
		{
			id: "research",
			displayName: "Mayuri",
			description: "Researches authoritative sources.",
			personality: "Curious and meticulous.",
		},
		{
			id: "audit",
			displayName: "Levi",
			description: "Audits concrete risks.",
			personality: "Blunt and disciplined.",
		},
	];
}

function messageText(messages: Array<{ role: string; content: unknown }>): string {
	return messages
		.flatMap((message) => {
			if (typeof message.content === "string") return [message.content];
			if (!Array.isArray(message.content)) return [];
			return message.content.flatMap((part) =>
				part && typeof part === "object" && "type" in part && part.type === "text" && "text" in part
					? [String(part.text)]
					: [],
			);
		})
		.join("\n");
}

describe("WorkerDirectory", () => {
	it("is a reusable source of worker identity, aliases, capability, and personality", async () => {
		const { registration, models } = createFaux();
		registration.setResponses([() => fauxAssistantMessage("Audit complete.")]);
		const directory = new WorkerDirectory({
			cwd: process.cwd(),
			workers: workers(),
			model: registration.getModel(),
			models,
		});

		expect(directory.listWorkers()).toMatchObject([
			{ id: "research", displayName: "Mayuri", personality: "Curious and meticulous." },
			{ id: "audit", displayName: "Levi", personality: "Blunt and disciplined." },
		]);
		const result = await directory.runOneShot("LEVI", "Audit this boundary.");
		expect(result.status).toBe("completed");
		expect(result.workerId).toBe("audit");
	});

	it("keeps bounded caller/worker dialogue so a named worker can be addressed again", async () => {
		const { registration, models } = createFaux();
		let secondTurnPrompt = "";
		registration.setResponses([
			() => fauxAssistantMessage("I found the first source."),
			(context) => {
				secondTurnPrompt = messageText(context.messages);
				return fauxAssistantMessage("I remember the first source.");
			},
		]);
		const directory = new WorkerDirectory({
			cwd: process.cwd(),
			workers: workers(),
			model: registration.getModel(),
			models,
		});

		const first = await directory.startConversation("Mayuri", "Find the first source.");
		const second = await directory.messageConversation(first.conversation.conversationId, "What did you find?");

		expect(first.result.status).toBe("completed");
		expect(second.result.status).toBe("completed");
		expect(second.conversation.workerId).toBe("research");
		expect(second.conversation.turnCount).toBe(2);
		expect(secondTurnPrompt).toContain("PERSISTENT WORKER CONVERSATION");
		expect(secondTurnPrompt).toContain("Find the first source.");
		expect(secondTurnPrompt).toContain("I found the first source.");
	});

	it("exposes running status and supports cancellation from another caller", async () => {
		const { registration, models } = createFaux();
		let release = () => {};
		const blocked = new Promise<void>((resolve) => {
			release = resolve;
		});
		registration.setResponses([
			async () => {
				await blocked;
				return fauxAssistantMessage("Late result.");
			},
		]);
		const directory = new WorkerDirectory({
			cwd: process.cwd(),
			workers: workers(),
			model: registration.getModel(),
			models,
		});

		const running = directory.startConversation("audit", "Wait for cancellation.");
		await new Promise((resolve) => setTimeout(resolve, 0));
		const [active] = directory.getStatus();
		expect(active.status).toBe("running");
		expect(directory.cancelConversation(active.conversationId)).toBe(true);
		release();

		const finished = await running;
		expect(finished.result.status).toBe("cancelled");
		expect(directory.getStatus(active.conversationId)[0].status).toBe("cancelled");
	});

	it("returns a typed failed turn and never leaves a conversation stuck running", async () => {
		const { models } = createFaux();
		const directory = new WorkerDirectory({
			cwd: process.cwd(),
			workers: workers(),
			getModel: () => undefined,
			models,
		});

		const turn = await directory.startConversation("Mayuri", "Try without an active model.");
		expect(turn.result.status).toBe("failed");
		expect(turn.result.error).toContain("without an active model");
		expect(turn.conversation.status).toBe("failed");
		expect(directory.getStatus(turn.conversation.conversationId)[0].status).toBe("failed");
	});

	it("mounts deterministic controls and exposes the full conversation id to the model", async () => {
		const { registration, models } = createFaux();
		registration.setResponses([() => fauxAssistantMessage("Conversation started.")]);
		const directory = new WorkerDirectory({
			cwd: process.cwd(),
			workers: workers(),
			model: registration.getModel(),
			models,
		});
		const tools = createWorkerControlTools(directory);

		expect(tools.map((tool) => tool.name)).toEqual([
			"worker_list",
			"worker_start",
			"worker_message",
			"worker_status",
			"worker_cancel",
			"worker_close",
		]);
		expect(tools.every((tool) => tool.executionMode === "parallel")).toBe(true);

		const start = tools.find((tool) => tool.name === "worker_start");
		if (!start) throw new Error("worker_start tool missing");
		const response = await start.execute("start-1", { worker: "Mayuri", message: "Start a conversation." });
		const fullId = response.details.conversation.conversationId;
		const text = response.content.find((item) => item.type === "text")?.text ?? "";
		expect(fullId).toMatch(/^[0-9a-f-]{36}$/);
		expect(text).toContain(`conversationId: ${fullId}`);
	});
});
