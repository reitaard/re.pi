import {
	createModels,
	createProvider,
	type Model,
	type Models,
	type ProviderHeaders,
} from "@earendil-works/pi-ai";
import { type ProviderStreamOptions, stream, streamSimple } from "@earendil-works/pi-ai/compat";
import type { ModelRegistry } from "../../core/model-registry.ts";

/** Bridge selected coding-agent models and resolved credentials into an isolated AgentHarness. */
export function createHarnessModels(
	modelOrModels: Model<any> | readonly Model<any>[],
	modelRegistry: ModelRegistry,
	purpose: string,
	beforeProviderHeaders?: (headers: ProviderHeaders) => Promise<ProviderHeaders>,
): Models {
	const selectedModels = (Array.isArray(modelOrModels) ? [...modelOrModels] : [modelOrModels]).filter(
		(model, index, models) =>
			models.findIndex((candidate) => candidate.provider === model.provider && candidate.id === model.id) === index,
	);
	if (selectedModels.length === 0) throw new Error(`No models configured for ${purpose}`);

	const models = createModels();
	const byProvider = new Map<string, Model<any>[]>();
	for (const model of selectedModels) {
		const providerModels = byProvider.get(model.provider) ?? [];
		providerModels.push(model);
		byProvider.set(model.provider, providerModels);
	}

	for (const [providerId, providerModels] of byProvider) {
		models.setProvider(
			createProvider({
				id: providerId,
				name: `${providerId} for ${purpose}`,
				models: providerModels,
				auth: {
					apiKey: {
						name: `${providerId} credentials`,
						resolve: async () => {
							const resolved = await modelRegistry.getApiKeyAndHeaders(providerModels[0]!);
							if (!resolved.ok) throw new Error(resolved.error);
							const baseHeaders: ProviderHeaders = { ...(resolved.headers ?? {}) };
							const headers = beforeProviderHeaders ? await beforeProviderHeaders(baseHeaders) : baseHeaders;
							return {
								auth: {
									apiKey: resolved.apiKey,
									headers: Object.keys(headers).length > 0 ? headers : undefined,
								},
								env: resolved.env,
							};
						},
					},
				},
				api: {
					stream: (requestModel, context, options) =>
						stream(requestModel, context, options as ProviderStreamOptions | undefined),
					streamSimple: (requestModel, context, options) => streamSimple(requestModel, context, options),
				},
			}),
		);
	}

	return models;
}
