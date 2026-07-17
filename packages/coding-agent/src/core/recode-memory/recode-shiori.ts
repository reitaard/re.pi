import type { Model } from "@reitaard/repi-ai";
import type { ExtensionAPI, ExtensionCommandContext } from "../extensions/types.ts";
import type { SessionEntry } from "../session-manager.ts";
import type { RecodeMemoryManager } from "./recode-memory-manager.ts";
import type { RecodeMemoryConfig, RecodeMemoryScope, RecodeShioriRouting } from "./recode-memory-types.ts";
import { runRecodeShioriHarness } from "./recode-shiori-harness.ts";

export const RECODE_SHIORI_CHECKPOINT = "recode-shiori-checkpoint";
export const RECODE_SHIORI_DISPLAY_NAME = "Shiori (\u681e)";
export const RECODE_SHIORI_MESSAGE_ENTRY = "recode-shiori-message";

export interface RecodeShioriMessageEntry {
	message: string;
}

export interface RecodeShioriProgressEvent {
	type: "start" | "complete";
	message: string;
}

const SHIORI_MEMORY_GREETINGS = [
	"Your memory is safe within my pages.",
	"Another memory for the archive.",
	"Let me preserve this fragment.",
	"I'll bind it to our story.",
	"Leave it with me. I'll keep it safe.",
	"I've saved it for later.",
	"Noted. You can ask me about it anytime.",
	"Saved. I won't bring it up unless it's useful.",
] as const;

const SHIORI_CHUNK_CHARACTERS = 24_000;
const SHIORI_MAX_CHUNKS_PER_RUN = 4;
const SHIORI_MAX_MEMORIES_PER_CHUNK = 10;
const activeShioriSessions = new WeakSet<object>();

export function getRecodeShioriGreeting(now = new Date(), random = Math.random): string {
	const hour = now.getHours();
	const period = hour >= 5 && hour < 12 ? "morning" : hour < 17 ? "afternoon" : "evening";
	const index = Math.min(
		SHIORI_MEMORY_GREETINGS.length - 1,
		Math.floor(Math.max(0, random()) * SHIORI_MEMORY_GREETINGS.length),
	);
	return `Good ${period}. ${SHIORI_MEMORY_GREETINGS[index]}`;
}

function buildRecodeShioriSystemPrompt(now: Date): string {
	const localDateTime = now.toLocaleString("en-US", {
		weekday: "long",
		year: "numeric",
		month: "long",
		day: "numeric",
		hour: "2-digit",
		minute: "2-digit",
		second: "2-digit",
		timeZoneName: "short",
	});
	return `You are ${RECODE_SHIORI_DISPLAY_NAME}, RePi's focused memory reviewer.
Current local date and time: ${localDateTime}.
Extract only durable, useful knowledge from the supplied transcript: user preferences and behavior, corrections, project decisions, stable workflows, verified facts, and lessons.
Ignore greetings, transient status, guesses, secrets, credentials, raw logs, and details that will not help a future session.
Return strict JSON only. Do not use Markdown.`;
}

export interface RecodeShioriMemoryCandidate {
	text: string;
	tags: string[];
	scope: RecodeMemoryScope;
	kind: "correction" | "decision" | "fact" | "lesson" | "preference" | "workflow";
	confidence: number;
	evidenceEntryIds: string[];
}

export interface RecodeShioriCheckpoint {
	lastReviewedEntryId: string;
	reviewedAt: string;
	saved: number;
}

interface RecodeShioriReviewChunk {
	entries: SessionEntry[];
	transcript: string;
}

interface RecodeShioriRunResult {
	reviewedEntries: number;
	saved: number;
	skippedDuplicates: number;
	hasMore: boolean;
	lastReviewedEntryId: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null;
}

function normalizeText(value: string): string {
	return value
		.toLowerCase()
		.replace(/#[\w-]+|\[\[[^\]]+\]\]/g, "")
		.replace(/[^\p{L}\p{N}]+/gu, " ")
		.trim();
}

function contentText(value: unknown): string {
	if (typeof value === "string") return value;
	if (!Array.isArray(value)) return "";
	return value
		.map((item) => {
			if (!isRecord(item)) return "";
			if (item.type === "text" && typeof item.text === "string") return item.text;
			if (item.type === "toolCall" && typeof item.name === "string") {
				const argumentsText = isRecord(item.arguments) ? JSON.stringify(item.arguments) : "";
				return `[tool ${item.name}${argumentsText ? ` ${argumentsText}` : ""}]`;
			}
			return "";
		})
		.filter(Boolean)
		.join("\n");
}

function renderEntry(entry: SessionEntry): string | undefined {
	if (entry.type !== "message") return undefined;
	const message = entry.message;
	if (message.role === "user") {
		const text = contentText(message.content).trim();
		return text ? `[${entry.id}] USER\n${text}` : undefined;
	}
	if (message.role === "assistant") {
		const text = contentText(message.content).trim();
		return text ? `[${entry.id}] ASSISTANT\n${text}` : undefined;
	}
	if (message.role === "toolResult") {
		const text = contentText(message.content).trim();
		const clipped =
			text.length > 2000 ? `${text.slice(0, 1600)}\n...[tool output clipped]...\n${text.slice(-300)}` : text;
		return `[${entry.id}] TOOL ${message.toolName}${message.isError ? " ERROR" : ""}\n${clipped || "(no text)"}`;
	}
	return undefined;
}

function checkpointFromEntry(entry: SessionEntry): RecodeShioriCheckpoint | undefined {
	if (entry.type !== "custom" || entry.customType !== RECODE_SHIORI_CHECKPOINT || !isRecord(entry.data))
		return undefined;
	if (typeof entry.data.lastReviewedEntryId !== "string" || typeof entry.data.reviewedAt !== "string")
		return undefined;
	return {
		lastReviewedEntryId: entry.data.lastReviewedEntryId,
		reviewedAt: entry.data.reviewedAt,
		saved: typeof entry.data.saved === "number" ? entry.data.saved : 0,
	};
}

export function getRecodeShioriCheckpoint(branch: SessionEntry[]): RecodeShioriCheckpoint | undefined {
	for (let index = branch.length - 1; index >= 0; index--) {
		const checkpoint = checkpointFromEntry(branch[index]!);
		if (checkpoint) return checkpoint;
	}
	return undefined;
}

export function buildRecodeShioriReviewChunks(branch: SessionEntry[]): {
	chunks: RecodeShioriReviewChunk[];
	pendingEntries: number;
	hasMore: boolean;
} {
	const checkpoint = getRecodeShioriCheckpoint(branch);
	const checkpointIndex = checkpoint ? branch.findIndex((entry) => entry.id === checkpoint.lastReviewedEntryId) : -1;
	const pending = branch.slice(checkpointIndex + 1).filter((entry) => renderEntry(entry) !== undefined);
	const chunks: RecodeShioriReviewChunk[] = [];
	let entries: SessionEntry[] = [];
	let transcriptParts: string[] = [];
	let length = 0;

	const flush = () => {
		if (entries.length === 0) return;
		chunks.push({ entries, transcript: transcriptParts.join("\n\n") });
		entries = [];
		transcriptParts = [];
		length = 0;
	};

	for (const entry of pending) {
		const rendered = renderEntry(entry)!;
		if (entries.length > 0 && length + rendered.length + 2 > SHIORI_CHUNK_CHARACTERS) flush();
		entries.push(entry);
		transcriptParts.push(rendered.slice(0, SHIORI_CHUNK_CHARACTERS));
		length += rendered.length + 2;
	}
	flush();

	return {
		chunks: chunks.slice(0, SHIORI_MAX_CHUNKS_PER_RUN),
		pendingEntries: pending.length,
		hasMore: chunks.length > SHIORI_MAX_CHUNKS_PER_RUN,
	};
}

function normalizeTags(value: unknown, kind: RecodeShioriMemoryCandidate["kind"]): string[] {
	const source = Array.isArray(value) ? value : [];
	const tags = source
		.filter((tag): tag is string => typeof tag === "string")
		.map((tag) =>
			tag
				.toLowerCase()
				.replace(/[^a-z0-9_-]+/g, "-")
				.replace(/^-+|-+$/g, ""),
		)
		.filter(Boolean);
	return [...new Set([kind, ...tags])].slice(0, 6);
}

export function parseRecodeShioriCandidates(output: string): RecodeShioriMemoryCandidate[] {
	let parsed: Record<string, unknown> | undefined;
	for (let start = output.indexOf("{"); start >= 0; start = output.indexOf("{", start + 1)) {
		let depth = 0;
		let inString = false;
		let escaped = false;
		for (let index = start; index < output.length; index++) {
			const character = output[index]!;
			if (inString) {
				if (escaped) escaped = false;
				else if (character === "\\") escaped = true;
				else if (character === '"') inString = false;
				continue;
			}
			if (character === '"') {
				inString = true;
				continue;
			}
			if (character === "{") depth += 1;
			else if (character === "}") depth -= 1;
			if (depth !== 0) continue;
			try {
				const candidate: unknown = JSON.parse(output.slice(start, index + 1));
				if (isRecord(candidate) && Array.isArray(candidate.memories)) parsed = candidate;
			} catch {
				// Keep scanning for the next balanced object; models may prefix JSON-like commentary.
			}
			break;
		}
		if (parsed) break;
	}
	if (!parsed) throw new Error("Shiori returned invalid JSON");
	const memories = parsed.memories;
	if (!Array.isArray(memories)) throw new Error("Shiori response is missing memories[]");
	const allowedKinds = new Set<RecodeShioriMemoryCandidate["kind"]>([
		"correction",
		"decision",
		"fact",
		"lesson",
		"preference",
		"workflow",
	]);
	const candidates: RecodeShioriMemoryCandidate[] = [];
	for (const value of memories.slice(0, SHIORI_MAX_MEMORIES_PER_CHUNK)) {
		if (!isRecord(value) || typeof value.text !== "string") continue;
		const text = value.text.trim().replace(/\s+/g, " ");
		if (text.length < 12 || text.length > 1000) continue;
		const kind = allowedKinds.has(value.kind as RecodeShioriMemoryCandidate["kind"])
			? (value.kind as RecodeShioriMemoryCandidate["kind"])
			: "fact";
		const confidence = typeof value.confidence === "number" ? value.confidence : 0.75;
		if (confidence < 0.6) continue;
		candidates.push({
			text,
			tags: normalizeTags(value.tags, kind),
			scope: value.scope === "global" ? "global" : "project",
			kind,
			confidence: Math.min(1, confidence),
			evidenceEntryIds: Array.isArray(value.evidenceEntryIds)
				? value.evidenceEntryIds.filter((id): id is string => typeof id === "string").slice(0, 8)
				: [],
		});
	}
	const unique = new Map<string, RecodeShioriMemoryCandidate>();
	for (const candidate of candidates) unique.set(normalizeText(candidate.text), candidate);
	return [...unique.values()];
}

function reviewPrompt(transcript: string): string {
	return `Review this bounded RePi session transcript.

Output exactly:
{"memories":[{"text":"concise durable statement","tags":["searchable-tag"],"scope":"project|global","kind":"preference|decision|workflow|correction|fact|lesson","confidence":0.0,"evidenceEntryIds":["entry-id"]}]}

Use project scope for codebase-specific knowledge. Use global only for stable user preferences or cross-project working habits. Return {"memories":[]} when nothing deserves durable memory.
Return at most 5 memories. Keep each text under 240 characters, use at most 4 tags, and cite at most 3 evidence entry IDs.

TRANSCRIPT
${transcript}`;
}

async function chooseRouting(
	routing: RecodeShioriRouting,
	candidate: RecodeShioriMemoryCandidate,
	ctx: ExtensionCommandContext,
	globalAccess: boolean,
): Promise<{ scope?: RecodeMemoryScope; cancelled: boolean }> {
	if (routing === "project") return { scope: "project", cancelled: false };
	if (routing === "global" && globalAccess) return { scope: "global", cancelled: false };
	if (routing === "auto" && (candidate.scope === "project" || globalAccess)) {
		return { scope: candidate.scope, cancelled: false };
	}
	if (!ctx.hasUI) return { scope: "project", cancelled: false };
	const selected = await ctx.ui.select(`${RECODE_SHIORI_DISPLAY_NAME}: save memory`, [
		"Project",
		...(globalAccess ? ["Global"] : []),
		"Skip",
	]);
	if (selected === undefined) return { cancelled: true };
	if (selected === "Global") return { scope: "global", cancelled: false };
	if (selected === "Project") return { scope: "project", cancelled: false };
	return { cancelled: false };
}

async function isDuplicate(manager: RecodeMemoryManager, candidate: RecodeShioriMemoryCandidate): Promise<boolean> {
	const results = await manager.search(candidate.text, 6, candidate.scope);
	const normalized = normalizeText(candidate.text);
	return results.some((result) => normalizeText(result.text).includes(normalized));
}

async function runRecodeShioriUnlocked(options: {
	pi: ExtensionAPI;
	ctx: ExtensionCommandContext;
	config: RecodeMemoryConfig;
	manager: RecodeMemoryManager;
	model?: Model<any>;
	onProgress?: (event: RecodeShioriProgressEvent) => void;
}): Promise<RecodeShioriRunResult | undefined> {
	const { pi, ctx, config, manager, onProgress } = options;
	const model = options.model ?? ctx.model;
	if (!config.enabled) throw new Error("Kioku memory is disabled. Enable it from /memory");
	if (!ctx.isProjectTrusted()) throw new Error("Shiori is unavailable until this project is trusted");
	if (!model) throw new Error("Shiori needs an active model");
	await ctx.waitForIdle();

	const branch = ctx.sessionManager.getBranch();
	const review = buildRecodeShioriReviewChunks(branch);
	if (review.chunks.length === 0) {
		ctx.ui.notify(`${RECODE_SHIORI_DISPLAY_NAME}: No new session entries to review.`, "info");
		return undefined;
	}

	const startedAt = new Date();
	const greeting = `${getRecodeShioriGreeting(startedAt)} (${review.pendingEntries} entries)`;
	if (onProgress) onProgress({ type: "start", message: greeting });
	else pi.appendEntry<RecodeShioriMessageEntry>(RECODE_SHIORI_MESSAGE_ENTRY, { message: greeting });
	ctx.ui.setStatus("recode-shiori", ctx.ui.theme.fg("success", `${RECODE_SHIORI_DISPLAY_NAME}: reviewing`));
	let saved = 0;
	let skippedDuplicates = 0;
	let reviewedEntries = 0;
	let lastReviewedEntryId = review.chunks[0]!.entries.at(-1)!.id;
	const seenCandidates = new Set<string>();
	const pendingWrites: RecodeShioriMemoryCandidate[] = [];

	try {
		for (const chunk of review.chunks) {
			const output = await runRecodeShioriHarness({
				cwd: ctx.cwd,
				model,
				modelRegistry: ctx.modelRegistry,
				thinking: config.shioriThinking,
				systemPrompt: buildRecodeShioriSystemPrompt(startedAt),
				prompt: reviewPrompt(chunk.transcript),
			});
			const candidates = parseRecodeShioriCandidates(output);
			for (const candidate of candidates) {
				const candidateKey = normalizeText(candidate.text);
				if (seenCandidates.has(candidateKey)) {
					skippedDuplicates += 1;
					continue;
				}
				seenCandidates.add(candidateKey);
				const route = await chooseRouting(config.cardinalRouting, candidate, ctx, config.globalAccess);
				if (route.cancelled) throw new Error("Cardinal routing cancelled");
				if (!route.scope) continue;
				const routed = { ...candidate, scope: route.scope };
				if (await isDuplicate(manager, routed)) {
					skippedDuplicates += 1;
					continue;
				}
				pendingWrites.push(routed);
			}
			reviewedEntries += chunk.entries.length;
			lastReviewedEntryId = chunk.entries.at(-1)!.id;
		}
		for (const candidate of pendingWrites) {
			await manager.write(candidate.scope, candidate.text, false, true, candidate.tags, false);
			saved += 1;
		}
		if (saved > 0) await manager.sync(true);
		pi.appendEntry(RECODE_SHIORI_CHECKPOINT, {
			lastReviewedEntryId,
			reviewedAt: new Date().toISOString(),
			saved,
		} satisfies RecodeShioriCheckpoint);
		ctx.ui.setStatus("recode-shiori", ctx.ui.theme.fg("success", `${RECODE_SHIORI_DISPLAY_NAME}: saved ${saved}`));
		const savedSummary = saved === 0 ? "No new memories" : `Saved ${saved} ${saved === 1 ? "memory" : "memories"}`;
		const completion = [
			savedSummary,
			`${reviewedEntries} reviewed`,
			skippedDuplicates > 0
				? `${skippedDuplicates} ${skippedDuplicates === 1 ? "duplicate" : "duplicates"} skipped`
				: undefined,
			review.hasMore ? "more entries remain" : undefined,
		]
			.filter((part): part is string => part !== undefined)
			.join(" · ");
		if (onProgress) onProgress({ type: "complete", message: completion });
		else pi.appendEntry<RecodeShioriMessageEntry>(RECODE_SHIORI_MESSAGE_ENTRY, { message: completion });
		return { reviewedEntries, saved, skippedDuplicates, hasMore: review.hasMore, lastReviewedEntryId };
	} catch (error) {
		ctx.ui.setStatus("recode-shiori", ctx.ui.theme.fg("error", `${RECODE_SHIORI_DISPLAY_NAME}: error`));
		throw error;
	}
}

export async function runRecodeShiori(options: {
	pi: ExtensionAPI;
	ctx: ExtensionCommandContext;
	config: RecodeMemoryConfig;
	manager: RecodeMemoryManager;
	model?: Model<any>;
	onProgress?: (event: RecodeShioriProgressEvent) => void;
}): Promise<RecodeShioriRunResult | undefined> {
	const session = options.ctx.sessionManager;
	if (activeShioriSessions.has(session)) {
		options.ctx.ui.notify(`${RECODE_SHIORI_DISPLAY_NAME}: A memory review is already running.`, "info");
		return undefined;
	}
	activeShioriSessions.add(session);
	try {
		return await runRecodeShioriUnlocked(options);
	} finally {
		activeShioriSessions.delete(session);
	}
}
