import type { AgentTool } from "@earendil-works/pi-agent-core";
import { EventBus } from "../../core/event-bus.ts";
import { loadExtensions } from "../../core/extensions/loader.ts";
import type {
	ExtensionAPI,
	ExtensionContext,
	ToolDefinition,
	ToolInfo,
} from "../../core/extensions/types.ts";

const extensionToolCache = new Map<string, Promise<Map<string, ToolDefinition>>>();

async function loadToolDefinitions(sourcePath: string, cwd: string): Promise<Map<string, ToolDefinition>> {
	let pending = extensionToolCache.get(sourcePath);
	if (!pending) {
		pending = (async () => {
			const loaded = await loadExtensions([sourcePath], cwd, new EventBus());
			const sourceErrors = loaded.errors.filter((error) => error.path === sourcePath);
			if (sourceErrors.length > 0) {
				throw new Error(
					`Could not load external worker tools from ${sourcePath}: ${sourceErrors.map((error) => error.error).join("; ")}`,
				);
			}
			const definitions = new Map<string, ToolDefinition>();
			for (const extension of loaded.extensions) {
				for (const [name, definition] of extension.tools) definitions.set(name, definition);
			}
			return definitions;
		})();
		extensionToolCache.set(sourcePath, pending);
	}
	return pending;
}

function asAgentTool(definition: ToolDefinition, ctx: ExtensionContext): AgentTool {
	return {
		name: definition.name,
		label: definition.label,
		description: definition.description,
		parameters: definition.parameters,
		executionMode: definition.executionMode,
		async execute(toolCallId, params, signal, onUpdate) {
			return definition.execute(toolCallId, params, signal, onUpdate, ctx);
		},
	};
}

function toolSourceByName(pi: ExtensionAPI): Map<string, ToolInfo> {
	return new Map(pi.getAllTools().map((tool) => [tool.name, tool]));
}

/** Resolve executable definitions for already-installed extension tools without duplicating their implementation. */
export async function resolveExternalAgentTools(
	pi: ExtensionAPI,
	ctx: ExtensionContext,
	names: readonly string[],
): Promise<AgentTool[]> {
	const toolsByName = toolSourceByName(pi);
	const definitionsBySource = new Map<string, Map<string, ToolDefinition>>();
	const resolved: AgentTool[] = [];

	for (const name of names) {
		const info = toolsByName.get(name);
		if (!info) throw new Error(`Required installed worker tool is unavailable: ${name}`);
		const sourcePath = info.sourceInfo.path;
		let definitions = definitionsBySource.get(sourcePath);
		if (!definitions) {
			definitions = await loadToolDefinitions(sourcePath, ctx.cwd);
			definitionsBySource.set(sourcePath, definitions);
		}
		const definition = definitions.get(name);
		if (!definition) {
			throw new Error(`Installed extension ${sourcePath} did not re-register required worker tool: ${name}`);
		}
		resolved.push(asAgentTool(definition, ctx));
	}

	return resolved;
}
