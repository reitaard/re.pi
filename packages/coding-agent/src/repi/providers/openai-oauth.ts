import type { Api, Model } from "@earendil-works/pi-ai";
import { getModels } from "@earendil-works/pi-ai/compat";
import type { ExtensionAPI, ProviderModelConfig } from "../../core/extensions/types.ts";

const DEFAULT_BASE_URL = "http://127.0.0.1:10531/v1";
const STARTUP_DISCOVERY_TIMEOUT_MS = 1500;
const MANUAL_DISCOVERY_TIMEOUT_MS = 10000;

interface DiscoveredModel {
	id: string;
	name?: string;
	contextWindow?: number;
	maxTokens?: number;
}

const ZERO_COST: ProviderModelConfig["cost"] = {
	input: 0,
	output: 0,
	cacheRead: 0,
	cacheWrite: 0,
};

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null;
}

export function normalizeRepiOpenAIOAuthBaseUrl(value: string): string {
	const trimmed = value.trim().replace(/\/+$/, "");
	return trimmed.endsWith("/v1") ? trimmed : `${trimmed}/v1`;
}

function configuredBaseUrl(): string {
	return normalizeRepiOpenAIOAuthBaseUrl(
		process.env.RECODE_OPENAI_OAUTH_BASE_URL || process.env.REPI_OPENAI_OAUTH_BASE_URL || DEFAULT_BASE_URL,
	);
}

function parseModels(payload: unknown): DiscoveredModel[] {
	if (!isRecord(payload) || !Array.isArray(payload.data)) return [];
	return payload.data.flatMap((entry) => {
		if (!isRecord(entry) || typeof entry.id !== "string" || entry.id.length === 0) return [];
		return [
			{
				id: entry.id,
				name: typeof entry.name === "string" ? entry.name : undefined,
				contextWindow: typeof entry.context_window === "number" ? entry.context_window : undefined,
				maxTokens: typeof entry.max_tokens === "number" ? entry.max_tokens : undefined,
			},
		];
	});
}

function isChatModel(model: DiscoveredModel): boolean {
	return !/(^|[-_.])(embed|embedding|rerank)([-_.]|$)/i.test(model.id) && !/^gpt-image(?:-|$)/i.test(model.id);
}

function displayName(id: string): string {
	return id
		.split(/[-_]/g)
		.filter(Boolean)
		.map((part) => {
			if (/^gpt$/i.test(part)) return "GPT";
			if (/^\d+(?:\.\d+)*$/.test(part)) return part;
			return `${part.charAt(0).toUpperCase()}${part.slice(1)}`;
		})
		.join(" ");
}

function inferredReasoningMetadata(id: string): Pick<ProviderModelConfig, "reasoning" | "thinkingLevelMap"> {
	const reasoning = /^gpt-5(?:[.-]|$)/i.test(id);
	if (!reasoning) return { reasoning: false };

	return {
		reasoning: true,
		thinkingLevelMap: /^gpt-5\.6(?:-|$)/i.test(id)
			? { minimal: "low", xhigh: "xhigh", max: "max" }
			: { minimal: "low", xhigh: "xhigh" },
	};
}

function inferredContextWindow(id: string): number | undefined {
	if (/^gpt-5\.6(?:-|$)/i.test(id)) return 372000;
	if (/^gpt-5(?:[.-]|$)/i.test(id)) return 272000;
	return undefined;
}

function inferredMaxTokens(id: string): number | undefined {
	return /^gpt-5(?:[.-]|$)/i.test(id) ? 128000 : undefined;
}

function codexCatalogById(): Map<string, Model<Api>> {
	return new Map((getModels("openai-codex") as Model<Api>[]).map((model) => [model.id, model]));
}

function toProviderModel(model: DiscoveredModel, catalog: Map<string, Model<Api>>): ProviderModelConfig {
	const known = catalog.get(model.id);
	const inferred = inferredReasoningMetadata(model.id);
	const reasoning = known?.reasoning ?? inferred.reasoning;
	const thinkingLevelMap = known?.thinkingLevelMap ? { ...known.thinkingLevelMap } : inferred.thinkingLevelMap;
	const input: ProviderModelConfig["input"] = known?.input
		? [...known.input]
		: /^gpt-/i.test(model.id)
			? ["text", "image"]
			: ["text"];

	return {
		id: model.id,
		name: `${known?.name ?? model.name ?? displayName(model.id)} (OAuth)`,
		api: "openai-responses",
		reasoning,
		thinkingLevelMap,
		input,
		cost: ZERO_COST,
		// Precedence is deliberate: the proxy is authoritative when it reports
		// metadata; RePi family overrides cover proxy aliases such as Sol/Terra/Luna;
		// the upstream catalog remains the fallback for all other known models.
		contextWindow: model.contextWindow ?? inferredContextWindow(model.id) ?? known?.contextWindow ?? 32768,
		maxTokens: model.maxTokens ?? inferredMaxTokens(model.id) ?? known?.maxTokens ?? 8192,
		compat: {
			...known?.compat,
			// The local OAuth proxy forwards complete stateless Responses requests,
			// but it does not provide OpenAI API's documented 24-hour cache contract.
			supportsLongCacheRetention: false,
		},
	};
}

async function discoverModels(baseUrl: string, timeoutMs: number): Promise<DiscoveredModel[]> {
	const response = await fetch(`${baseUrl}/models`, { signal: AbortSignal.timeout(timeoutMs) });
	if (!response.ok) throw new Error(`OpenAI OAuth proxy returned HTTP ${response.status}`);
	const models = parseModels(await response.json()).filter(isChatModel);
	if (models.length === 0) throw new Error("OpenAI OAuth proxy returned no chat models");
	return models;
}

export async function registerRepiOpenAIOAuth(
	pi: ExtensionAPI,
	baseUrl = configuredBaseUrl(),
	timeoutMs = MANUAL_DISCOVERY_TIMEOUT_MS,
): Promise<number> {
	const normalizedBaseUrl = normalizeRepiOpenAIOAuthBaseUrl(baseUrl);
	const discovered = await discoverModels(normalizedBaseUrl, timeoutMs);
	const catalog = codexCatalogById();
	const models = discovered.map((model) => toProviderModel(model, catalog));

	pi.registerProvider("openai-oauth", {
		name: "OpenAI OAuth",
		baseUrl: normalizedBaseUrl,
		api: "openai-responses",
		// Pi requires a non-empty local key. authHeader=false prevents a fabricated
		// Authorization header from being sent to the local OAuth proxy.
		apiKey: "local",
		authHeader: false,
		models,
	});

	return models.length;
}

export async function repiOpenAIOAuth(pi: ExtensionAPI): Promise<void> {
	const baseUrl = configuredBaseUrl();

	try {
		await registerRepiOpenAIOAuth(pi, baseUrl, STARTUP_DISCOVERY_TIMEOUT_MS);
	} catch {
		// Optional provider: a stopped local proxy must not delay or break startup.
	}

	pi.registerCommand("openai-oauth", {
		description: "Refresh models from the local OpenAI OAuth proxy",
		handler: async (_args, ctx) => {
			try {
				const count = await registerRepiOpenAIOAuth(pi, baseUrl, MANUAL_DISCOVERY_TIMEOUT_MS);
				ctx.ui.notify(`OpenAI OAuth refreshed with ${count} chat model${count === 1 ? "" : "s"}`, "info");
			} catch (error) {
				ctx.ui.notify(error instanceof Error ? error.message : String(error), "error");
			}
		},
	});
}
