import { join } from "node:path";
import type { AgentTool, Skill } from "@earendil-works/pi-agent-core";
import { getAgentDir } from "../../config.ts";
import type { ExtensionAPI, ExtensionContext } from "../../core/extensions/types.ts";
import { createToolDefinitionFromAgentTool } from "../../core/tools/tool-definition-wrapper.ts";
import { createDelegateTool } from "./delegate-tool.ts";
import { resolveExternalAgentTools } from "./external-tool-loader.ts";
import type { NamedWorkerSkill } from "./named-worker.ts";
import { REPI_NAMED_WORKERS } from "./worker-registry.ts";
import { WorkerDirectory } from "./worker-directory.ts";
import {
	applyWorkerSettingsConfig,
	readWorkerSettingsConfig,
} from "./worker-settings.ts";
import { ensureWorkerStorage } from "./worker-storage.ts";
import { createWorkerControlTools } from "./worker-tools.ts";

const WEB_TOOL_NAMES = ["web_search", "fetch_content", "get_search_content"] as const;
const SETTINGS_FILE = "recode-workers.json";

function toNamedWorkerSkill(skill: Skill): NamedWorkerSkill {
	return {
		name: skill.name,
		description: skill.description,
		filePath: skill.filePath,
		disableModelInvocation: skill.disableModelInvocation,
	};
}

function createDirectoryFacade(getDirectory: () => WorkerDirectory | undefined): WorkerDirectory {
	return new Proxy({} as WorkerDirectory, {
		get(_target, property) {
			if (property === "getWorkerDefinitions") return () => REPI_NAMED_WORKERS;
			const directory = getDirectory();
			if (!directory) {
				return () => {
					throw new Error("Worker directory is not ready for the current Recode session");
				};
			}
			const value = Reflect.get(directory, property, directory);
			return typeof value === "function" ? value.bind(directory) : value;
		},
	});
}

export function repiWorkers(pi: ExtensionAPI): void {
	let directory: WorkerDirectory | undefined;
	let currentContext: ExtensionContext | undefined;
	let loadedSkills: readonly NamedWorkerSkill[] = [];
	let externalTools: readonly AgentTool[] = [];
	let externalToolError: string | undefined;
	const facade = createDirectoryFacade(() => directory);

	for (const tool of [createDelegateTool({ directory: facade }), ...createWorkerControlTools(facade)]) {
		pi.registerTool(createToolDefinitionFromAgentTool(tool));
	}

	const refreshExternalTools = async (ctx: ExtensionContext): Promise<void> => {
		try {
			externalTools = await resolveExternalAgentTools(pi, ctx, WEB_TOOL_NAMES);
			externalToolError = undefined;
		} catch (error) {
			externalTools = [];
			externalToolError = error instanceof Error ? error.message : String(error);
		}
	};

	const createDirectory = async (ctx: ExtensionContext): Promise<void> => {
		directory?.closeAll();
		currentContext = ctx;
		await refreshExternalTools(ctx);
		directory = new WorkerDirectory({
			cwd: ctx.cwd,
			workers: REPI_NAMED_WORKERS,
			getModel: () => currentContext?.model,
			getSkills: () => loadedSkills,
			getExternalTools: (worker) =>
				(worker.tools ?? []).some((name) => WEB_TOOL_NAMES.includes(name as (typeof WEB_TOOL_NAMES)[number]))
					? externalTools
					: [],
			modelRegistry: ctx.modelRegistry,
		});
		await ensureWorkerStorage(getAgentDir(), ctx.cwd, REPI_NAMED_WORKERS);
		applyWorkerSettingsConfig(
			directory,
			await readWorkerSettingsConfig(join(getAgentDir(), SETTINGS_FILE)),
		);
		ctx.ui.setStatus(
			"repi-workers",
			externalToolError ? "Workers · Levi ready · Mayuri web unavailable" : "Workers · Mayuri + Levi ready",
		);
	};

	pi.on("session_start", async (_event, ctx) => {
		await createDirectory(ctx);
	});

	pi.on("before_agent_start", async (event, ctx) => {
		currentContext = ctx;
		loadedSkills = (event.systemPromptOptions.skills ?? []).map(toNamedWorkerSkill);
		if (externalTools.length === 0) await refreshExternalTools(ctx);
		if (directory) {
			directory.updateRuntime({
				getModel: () => currentContext?.model,
				getSkills: () => loadedSkills,
				getExternalTools: (worker) =>
					(worker.tools ?? []).some((name) => WEB_TOOL_NAMES.includes(name as (typeof WEB_TOOL_NAMES)[number]))
						? externalTools
						: [],
				modelRegistry: ctx.modelRegistry,
			});
		}
	});

	pi.on("session_shutdown", () => {
		directory?.closeAll();
		directory = undefined;
		currentContext = undefined;
	});
}
