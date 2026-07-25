import { createHash } from "node:crypto";
import type { KiokuMemoryChunk, KiokuMemoryScope } from "./types.ts";

const TARGET_CHARACTERS = 1600;
const OVERLAP_CHARACTERS = 320;

function estimateTokens(text: string): number {
	return Math.max(1, Math.ceil(text.length / 4));
}

function chunkId(documentId: string, lineStart: number, text: string): string {
	return createHash("sha256").update(`${documentId}:${lineStart}:${text}`).digest("hex").slice(0, 24);
}

export function kiokuDocumentId(scope: KiokuMemoryScope, path: string): string {
	return createHash("sha256").update(`${scope}:${path}`).digest("hex").slice(0, 24);
}

export function chunkKiokuMemory(
	documentId: string,
	scope: KiokuMemoryScope,
	path: string,
	content: string,
): KiokuMemoryChunk[] {
	const lines = content.replace(/\r\n/g, "\n").split("\n");
	const chunks: KiokuMemoryChunk[] = [];
	let start = 0;

	while (start < lines.length) {
		let end = start;
		let size = 0;
		while (end < lines.length && (size < TARGET_CHARACTERS || end === start)) {
			size += lines[end].length + 1;
			end += 1;
		}

		const text = lines.slice(start, end).join("\n").trim();
		if (text) {
			chunks.push({
				id: chunkId(documentId, start + 1, text),
				documentId,
				scope,
				path,
				lineStart: start + 1,
				lineEnd: end,
				text,
				tokenCount: estimateTokens(text),
			});
		}

		if (end >= lines.length) break;
		let overlap = 0;
		let nextStart = end;
		while (nextStart > start + 1 && overlap < OVERLAP_CHARACTERS) {
			nextStart -= 1;
			overlap += lines[nextStart].length + 1;
		}
		start = nextStart;
	}

	return chunks;
}
