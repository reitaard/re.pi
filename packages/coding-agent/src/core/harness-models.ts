import {
	createModels,
	createProvider,
	type Model,
	type Models,
	type ProviderHeaders,
	type StreamOptions,
} from "@reitaard/repi-ai";
import { type ProviderStreamOptions, stream, streamSimple } from "@reitaard/repi-ai/compat";
import type { ModelRegistry } from "./model-registry.ts";

/**
 * Bridge one coding-agent model and its resolved credentials into AgentHarness.
 *
 * The collection is intentionally private to the caller. This prevents an
 * isolated runtime from inheriting unrelated providers or ambient model state.
 */
export function createHarnessModels(
	model: Model<any>,
	modelRegistry: ModelRegistry,
	purpose: string,
	beforeProviderHeaders?: (headers: ProviderHeaders) => Promise<ProviderHeaders>,
): Models {
	const models = createModels({
		prepareRequest: beforeProviderHeaders
			? async (_requestModel, options) =>
					({
						...options,
						headers: await beforeProviderHeaders(options?.headers ?? {}),
					}) as StreamOptions
			: undefined,
	});
	models.setProvider(
		createProvider({
			id: model.provider,
			name: `${model.provider} for ${purpose}`,
			models: [model],
			auth: {
				apiKey: {
					name: `${model.provider} credentials`,
					resolve: async () => {
						const resolved = await modelRegistry.getApiKeyAndHeaders(model);
						if (!resolved.ok) throw new Error(resolved.error);
						return {
							auth: { apiKey: resolved.apiKey, headers: resolved.headers },
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
	return models;
}
