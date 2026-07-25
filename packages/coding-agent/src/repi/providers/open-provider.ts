import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { getAgentDir } from "../../config.ts";
import type { ExtensionAPI, ProviderModelConfig } from "../../core/extensions/types.ts";

export interface RepiOpenProviderConfig {
	baseUrl: string;
	apiKey: string;
}

interface DiscoveredModel {
	id: string;
	name?: string;
	contextWindow?: number;
	maxTokens?: number;
}

interface NativeModel {
	id: string;
	name?: string;
	type?: string;
	contextWindow?: number;
	vision: boolean;
	reasoning: boolean;
}

const DEFAULT_CONFIG: RepiOpenProviderConfig = {
	baseUrl: "http://127.0.0.1:1234/v1",
	apiKey: "",
};
const STARTUP_DISCOVERY_TIMEOUT_MS = 1500;
const MANUAL_DISCOVERY_TIMEOUT_MS = 10000;

function configPath(): string {
	return join(getAgentDir(), "recode-open-provider.json");
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null;
}

export function normalizeRepiOpenProviderBaseUrl(value: string): string {
	const trimmed = value.trim().replace(/\/+$/, "");
	return trimmed.endsWith("/v1") ? trimmed : `${trimmed}/v1`;
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

function parseNativeModels(payload: unknown): NativeModel[] {
	if (!isRecord(payload) || !Array.isArray(payload.models)) return [];
	return payload.models.flatMap((entry) => {
		if (!isRecord(entry) || typeof entry.key !== "string") return [];

		const capabilities: Record<string, unknown> = isRecord(entry.capabilities) ? entry.capabilities : {};
		const reasoning = capabilities.reasoning;
		const hasReasoning =
			reasoning === true ||
			(isRecord(reasoning) && Array.isArray(reasoning.allowed_options) && reasoning.allowed_options.includes("on"));
		const loadedInstances = Array.isArray(entry.loaded_instances) ? entry.loaded_instances : [];
		const loadedInstance = loadedInstances.find((instance) => isRecord(instance) && instance.id === entry.key);
		const loadedConfig =
			isRecord(loadedInstance) && isRecord(loadedInstance.config) ? loadedInstance.config : undefined;
		const loadedContext =
			loadedConfig && typeof loadedConfig.context_length === "number"
				? loadedConfig.context_length
				: isRecord(loadedInstance) && typeof loadedInstance.context_length === "number"
					? loadedInstance.context_length
					: undefined;

		return [
			{
				id: entry.key,
				name: typeof entry.display_name === "string" ? entry.display_name : undefined,
				type: typeof entry.type === "string" ? entry.type : undefined,
				contextWindow:
					loadedContext ?? (typeof entry.max_context_length === "number" ? entry.max_context_length : undefined),
				vision: capabilities.vision === true,
				reasoning: hasReasoning,
			},
		];
	});
}

async function readConfig(): Promise<RepiOpenProviderConfig | undefined> {
	try {
		const parsed: unknown = JSON.parse(await readFile(configPath(), "utf8"));
		if (!isRecord(parsed) || typeof parsed.baseUrl !== "string") return undefined;
		return {
			baseUrl: normalizeRepiOpenProviderBaseUrl(parsed.baseUrl),
			apiKey: typeof parsed.apiKey === "string" ? parsed.apiKey : "",
		};
	} catch {
		return undefined;
	}
}

async function saveConfig(config: RepiOpenProviderConfig): Promise<void> {
	const path = configPath();
	await mkdir(dirname(path), { recursive: true });
	await writeFile(path, `${JSON.stringify(config, null, 2)}\n`, "utf8");
}

function nativeApiBaseUrl(value: string): string {
	return normalizeRepiOpenProviderBaseUrl(value).replace(/\/v1$/, "");
}

async function discoverNativeModels(
	baseUrl: string,
	headers: Record<string, string>,
	timeoutMs: number,
): Promise<NativeModel[]> {
	try {
		const response = await fetch(`${nativeApiBaseUrl(baseUrl)}/api/v1/models`, {
			headers,
			signal: AbortSignal.timeout(timeoutMs),
		});
		if (!response.ok) return [];
		return parseNativeModels(await response.json());
	} catch {
		return [];
	}
}

function isChatModel(model: DiscoveredModel, nativeModel: NativeModel | undefined): boolean {
	if (nativeModel?.type && /^(embedding|rerank|image)$/i.test(nativeModel.type)) return false;
	return !/(^|[-_.])(embed|embedding|rerank)([-_.]|$)/i.test(model.id) && !/^gpt-image(?:-|$)/i.test(model.id);
}

export async function registerRepiOpenProvider(
	pi: ExtensionAPI,
	config: RepiOpenProviderConfig,
	timeoutMs = MANUAL_DISCOVERY_TIMEOUT_MS,
): Promise<number> {
	const headers: Record<string, string> = {};
	if (config.apiKey) headers.Authorization = `Bearer ${config.apiKey}`;
	const baseUrl = normalizeRepiOpenProviderBaseUrl(config.baseUrl);
	const response = await fetch(`${baseUrl}/models`, {
		headers,
		signal: AbortSignal.timeout(timeoutMs),
	});
	if (!response.ok) throw new Error(`Open Provider returned HTTP ${response.status}`);

	const nativeModels = await discoverNativeModels(baseUrl, headers, timeoutMs);
	const nativeById = new Map(nativeModels.map((model) => [model.id, model]));
	const discovered = parseModels(await response.json()).filter((model) => isChatModel(model, nativeById.get(model.id)));
	if (discovered.length === 0) throw new Error("Open Provider returned no chat models");

	const models: ProviderModelConfig[] = discovered.map((model) => {
		const nativeModel = nativeById.get(model.id);
		const reasoning = nativeModel?.reasoning ?? false;
		return {
			id: model.id,
			name: nativeModel?.name ?? model.name ?? model.id,
			reasoning,
			thinkingLevelMap: reasoning ? { minimal: null, low: null, high: null, xhigh: null, max: null } : undefined,
			input: nativeModel?.vision ? ["text", "image"] : ["text"],
			cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
			contextWindow: nativeModel?.contextWindow ?? model.contextWindow ?? 32768,
			maxTokens: model.maxTokens ?? 8192,
			compat: reasoning ? { thinkingFormat: "qwen-chat-template", supportsReasoningEffort: false } : undefined,
		};
	});

	pi.registerProvider("open-provider", {
		name: "Open Provider",
		baseUrl,
		api: "openai-completions",
		apiKey: config.apiKey || "local",
		authHeader: config.apiKey.length > 0,
		models,
	});
	return models.length;
}

export async function repiOpenProvider(pi: ExtensionAPI): Promise<void> {
	const savedConfig = await readConfig();
	let config = savedConfig ?? DEFAULT_CONFIG;

	if (savedConfig) {
		try {
			await registerRepiOpenProvider(pi, config, STARTUP_DISCOVERY_TIMEOUT_MS);
		} catch {
			// Optional provider: an unavailable local or tailnet endpoint must not block startup.
		}
	}

	pi.registerCommand("open-provider", {
		description: "Configure and refresh the dynamic Open Provider",
		handler: async (_args, ctx) => {
			const baseUrl = await ctx.ui.input("Open Provider Base URL", config.baseUrl);
			if (baseUrl === undefined || baseUrl.trim() === "") return;
			const apiKey = await ctx.ui.input(
				config.apiKey
					? "Open Provider API key (optional; blank keeps saved key, '-' clears it)"
					: "Open Provider API key (optional)",
				"",
			);
			if (apiKey === undefined) return;

			config = {
				baseUrl: normalizeRepiOpenProviderBaseUrl(baseUrl),
				apiKey: apiKey === "-" ? "" : apiKey.trim() || config.apiKey,
			};
			await saveConfig(config);
			try {
				const count = await registerRepiOpenProvider(pi, config, MANUAL_DISCOVERY_TIMEOUT_MS);
				ctx.ui.notify(`Open Provider configured with ${count} chat model${count === 1 ? "" : "s"}`, "info");
			} catch (error) {
				ctx.ui.notify(error instanceof Error ? error.message : String(error), "error");
			}
		},
	});
}
