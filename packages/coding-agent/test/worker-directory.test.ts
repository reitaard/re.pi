import { createModels, fauxAssistantMessage, fauxProvider } from "@reitaard/repi-ai";
import { describe, expect, it } from "vitest";
import type { NamedWorkerDefinition } from "../src/core/delegation/named-worker.ts";
import { WorkerChatController } from "../src/core/delegation/worker-chat.ts";
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
			aliases: ["研究"],
			description: "Researches authoritative sources.",
			personality: "Curious and meticulous.",
		},
		{
			id: "audit",
			displayName: "Levi",
			aliases: ["監査"],
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
		let oneShotPrompt = "";
		registration.setResponses([
			(context) => {
				oneShotPrompt = messageText(context.messages);
				return fauxAssistantMessage("Audit complete.");
			},
		]);
		const directory = new WorkerDirectory({
			cwd: process.cwd(),
			workers: workers(),
			model: registration.getModel(),
			models,
		});

		expect(directory.listWorkers()).toMatchObject([
			{ id: "research", displayName: "Mayuri", aliases: ["研究"], personality: "Curious and meticulous." },
			{ id: "audit", displayName: "Levi", aliases: ["監査"], personality: "Blunt and disciplined." },
		]);
		const result = await directory.runOneShot("監査", "Audit this boundary.");
		expect(result.status).toBe("completed");
		expect(result.workerId).toBe("audit");
		expect(result.workerAliases).toEqual(["監査"]);
		expect(oneShotPrompt).toContain("id=aizen; name=Aizen (藍染); kind=agent; role=primary-agent");
	});

	it("keeps bounded Aizen/worker dialogue so a named worker can be addressed again", async () => {
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
		expect(secondTurnPrompt).toContain("id=aizen; name=Aizen (藍染); kind=agent; role=primary-agent");
		expect(secondTurnPrompt).toContain("Aizen (藍染): Find the first source.");
		expect(secondTurnPrompt).toContain("Find the first source.");
		expect(secondTurnPrompt).toContain("I found the first source.");
	});

	it("keeps a direct-chat code word inside that session and applies worker runtime settings", async () => {
		const { registration, models } = createFaux();
		let firstTurnPrompt = "";
		let followUpPrompt = "";
		registration.setResponses([
			(context) => {
				firstTurnPrompt = messageText(context.messages);
				return fauxAssistantMessage("I will remember bluebird.");
			},
			(context) => {
				followUpPrompt = messageText(context.messages);
				return fauxAssistantMessage("The code word is bluebird.");
			},
		]);
		const directory = new WorkerDirectory({
			cwd: process.cwd(),
			workers: workers(),
			model: registration.getModel(),
			models,
		});

		directory.setWorkerSettings("監査", { thinkingLevel: "high", maxOutputTokens: 4096 });
		const chat = new WorkerChatController(directory);
		await chat.send("Levi", "Remember the code word bluebird.");
		const reply = await chat.send("監査", "What was the code word?");

		expect(followUpPrompt).toContain("Remember the code word bluebird.");
		expect(followUpPrompt).toContain("I will remember bluebird.");
		expect(firstTurnPrompt).toContain("id=creator; name=Creator; kind=human; role=creator");
		expect(followUpPrompt).toContain("Creator: Remember the code word bluebird.");
		expect(followUpPrompt).not.toContain("Caller:");
		expect(reply.result.output).toBe("The code word is bluebird.");
		expect(reply.conversation.speaker).toMatchObject({ id: "creator", kind: "human", role: "creator" });
		expect(directory.getWorkerSettings("Levi")).toMatchObject({
			thinkingLevel: "high",
			maxOutputTokens: 4096,
		});
		expect(directory.listWorkers().find((worker) => worker.id === "audit")).toMatchObject({
			thinkingLevel: "high",
			maxOutputTokens: 4096,
		});
	});

	it("supports a direct named-worker chat while the host keeps the conversation id private", async () => {
		const { registration, models } = createFaux();
		registration.setResponses([
			() => fauxAssistantMessage("Levi is ready."),
			() => fauxAssistantMessage("The audit handoff is complete."),
		]);
		const directory = new WorkerDirectory({
			cwd: process.cwd(),
			workers: workers(),
			model: registration.getModel(),
			models,
		});

		const chat = new WorkerChatController(directory);
		const opened = await chat.send("監査", "Open a direct audit chat.");
		const conversationId = chat.getConversationId("Levi");
		const reply = await chat.send("audit", "Present the handoff to Aizen.");

		expect(conversationId).toBe(opened.conversation.conversationId);
		expect(reply.conversation.workerName).toBe("Levi");
		expect(reply.conversation.conversationId).toBe(conversationId);
		expect(reply.conversation.turnCount).toBe(2);
		expect(reply.result.output).toBe("The audit handoff is complete.");
		expect(chat.close("Levi (監査)")).toBe(true);
		expect(directory.getStatus()).toHaveLength(0);
	});

	it("restores a bounded direct chat into a new runtime", async () => {
		const firstRuntime = createFaux();
		firstRuntime.registration.setResponses([() => fauxAssistantMessage("I will remember bluebird.")]);
		const firstDirectory = new WorkerDirectory({
			cwd: process.cwd(),
			workers: workers(),
			model: firstRuntime.registration.getModel(),
			models: firstRuntime.models,
		});
		const firstChat = new WorkerChatController(firstDirectory);
		const first = await firstChat.send("Levi", "Remember bluebird.");

		const resumedRuntime = createFaux();
		let resumedPrompt = "";
		resumedRuntime.registration.setResponses([
			(context) => {
				resumedPrompt = messageText(context.messages);
				return fauxAssistantMessage("bluebird");
			},
		]);
		const resumedDirectory = new WorkerDirectory({
			cwd: process.cwd(),
			workers: workers(),
			model: resumedRuntime.registration.getModel(),
			models: resumedRuntime.models,
		});
		resumedDirectory.restoreConversationTurn({
			conversationId: first.conversation.conversationId,
			workerId: first.conversation.workerId,
			speaker: first.conversation.speaker,
			message: "Remember bluebird.",
			result: first.result,
			createdAt: first.conversation.createdAt,
			updatedAt: first.conversation.updatedAt,
			turnCount: first.conversation.turnCount,
		});
		const resumedChat = new WorkerChatController(resumedDirectory);
		resumedChat.restore("監査", first.conversation.conversationId);
		const reply = await resumedChat.send("Levi", "What did I ask you to remember?");

		expect(reply.conversation.turnCount).toBe(2);
		expect(reply.result.output).toBe("bluebird");
		expect(resumedPrompt).toContain("Creator: Remember bluebird.");
		expect(resumedPrompt).toContain("Levi: I will remember bluebird.");
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
