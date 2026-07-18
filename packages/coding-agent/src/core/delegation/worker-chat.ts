import { type OrchestrationActorIdentity, REPI_CREATOR_IDENTITY } from "./orchestration-identity.ts";
import type { WorkerConversationTurnResult, WorkerDirectory } from "./worker-directory.ts";

/** Host-owned direct-chat state. Conversation ids never need to enter user input. */
export class WorkerChatController {
	private readonly conversations = new Map<string, string>();
	private readonly directory: WorkerDirectory;
	private readonly speaker: OrchestrationActorIdentity;

	constructor(directory: WorkerDirectory, speaker: OrchestrationActorIdentity = REPI_CREATOR_IDENTITY) {
		this.directory = directory;
		this.speaker = speaker;
	}

	async send(workerReference: string, message: string, signal?: AbortSignal): Promise<WorkerConversationTurnResult> {
		const worker = this.directory.resolveWorker(workerReference);
		const conversationId = this.conversations.get(worker.id);
		const turn = conversationId
			? await this.directory.messageConversation(conversationId, message, undefined, signal)
			: await this.directory.startConversation(worker.id, message, undefined, signal, this.speaker);
		this.conversations.set(worker.id, turn.conversation.conversationId);
		return turn;
	}

	getConversationId(workerReference: string): string | undefined {
		return this.conversations.get(this.directory.resolveWorker(workerReference).id);
	}

	restore(workerReference: string, conversationId: string): void {
		const worker = this.directory.resolveWorker(workerReference);
		const snapshot = this.directory.getStatus(conversationId)[0];
		if (!snapshot || snapshot.workerId !== worker.id) {
			throw new Error(`Cannot restore direct chat for ${worker.displayName}: ${conversationId}`);
		}
		this.conversations.set(worker.id, conversationId);
	}

	close(workerReference: string): boolean {
		const worker = this.directory.resolveWorker(workerReference);
		const conversationId = this.conversations.get(worker.id);
		if (!conversationId) return false;
		this.directory.closeConversation(conversationId);
		this.conversations.delete(worker.id);
		return true;
	}

	clear(): void {
		this.conversations.clear();
	}
}
