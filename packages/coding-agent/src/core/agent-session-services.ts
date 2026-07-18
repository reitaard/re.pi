import { join } from "node:path";
import type { AgentTool, ThinkingLevel } from "@reitaard/repi-agent-core";
import type { Model } from "@reitaard/repi-ai";
import { getAgentDir } from "../config.ts";
import { recodeWorkers, withWorkerToolPresentation } from "../recode-workers.ts";
import { resolvePath } from "../utils/paths.ts";
import { AuthStorage } from "./auth-storage.ts";
import {
	createDelegateTool,
	createWorkerControlTools,
	REPI_NAMED_WORKERS,
	WorkerDirectory,
} from "./delegation/index.ts";
import type { ExtensionContext, SessionStartEvent, ToolDefinition } from "./extensions/index.ts";
import { ModelRegistry } from "./model-registry.ts";
import {
	DefaultResourceLoader,
	type DefaultResourceLoaderOptions,
	type ResourceLoader,
	type ResourceLoaderReloadOptions,
} from "./resource-loader.ts";
import { type CreateAgentSessionOptions, type CreateAgentSessionResult, createAgentSession } from "./sdk.ts";
import type { SessionManager } from "./session-manager.ts";
import { SettingsManager } from "./settings-manager.ts";
import { createToolDefinitionFromAgentTool, wrapToolDefinition } from "./tools/tool-definition-wrapper.ts";

const DELEGATION_ENV = "REPI_DELEGATION";
const MAYURI_WEB_TOOL_NAMES = ["web_search", "fetch_content", "get_search_content"] as const;

/** Non-fatal issues collected while creating services or sessions. */
export interface AgentSessionRuntimeDiagnostic {
	type: "info" | "warning" | "error";
	message: string;
}

/** Inputs for creating cwd-bound runtime services. */
export interface CreateAgentSessionServicesOptions {
	cwd: string;
	agentDir?: string;
	authStorage?: AuthStorage;
	settingsManager?: SettingsManager;
	modelRegistry?: ModelRegistry;
	extensionFlagValues?: Map<string, boolean | string>;
	resourceLoaderOptions?: Omit<DefaultResourceLoaderOptions, "cwd" | "agentDir" | "settingsManager">;
	resourceLoaderReloadOptions?: ResourceLoaderReloadOptions;
}

/** Inputs for creating an AgentSession from already-created services. */
export interface CreateAgentSessionFromServicesOptions {
	services: AgentSessionServices;
	sessionManager: SessionManager;
	sessionStartEvent?: SessionStartEvent;
	model?: Model<any>;
	thinkingLevel?: ThinkingLevel;
	scopedModels?: Array<{ model: Model<any>; thinkingLevel?: ThinkingLevel }>;
	tools?: string[];
	excludeTools?: CreateAgentSessionOptions["excludeTools"];
	noTools?: CreateAgentSessionOptions["noTools"];
	customTools?: ToolDefinition[];
}

/** Coherent cwd-bound runtime services for one effective session cwd. */
export interface AgentSessionServices {
	cwd: string;
	agentDir: string;
	authStorage: AuthStorage;
	settingsManager: SettingsManager;
	modelRegistry: ModelRegistry;
	resourceLoader: ResourceLoader;
	/** Shared by every Aizen/session built from these services. */
	workerDirectory?: WorkerDirectory;
	diagnostics: AgentSessionRuntimeDiagnostic[];
}

function isTruthyEnvFlag(value: string | undefined): boolean {
	if (!value) return false;
	return value === "1" || value.toLowerCase() === "true" || value.toLowerCase() === "yes";
}

function resolveCurrentModel(options: CreateAgentSessionFromServicesOptions): Model<any> | undefined {
	const persisted = options.sessionManager.buildSessionContext().model;
	if (!persisted) return options.model;
	return options.services.modelRegistry.find(persisted.provider, persisted.modelId) ?? options.model;
}

function createWorkerExtensionContext(options: CreateAgentSessionFromServicesOptions): ExtensionContext {
	return {
		ui: {} as ExtensionContext["ui"],
		mode: "print",
		hasUI: false,
		cwd: options.services.cwd,
		sessionManager: options.sessionManager,
		modelRegistry: options.services.modelRegistry,
		model: resolveCurrentModel(options),
		isIdle: () => true,
		isProjectTrusted: () => options.services.settingsManager.isProjectTrusted(),
		signal: undefined,
		abort: () => undefined,
		hasPendingMessages: () => false,
		shutdown: () => undefined,
		getContextUsage: () => undefined,
		compact: () => undefined,
		getSystemPrompt: () => "",
	};
}

function createMayuriWebTools(options: CreateAgentSessionFromServicesOptions): AgentTool[] {
	const definitionsByName = new Map<string, ToolDefinition>();
	for (const extension of options.services.resourceLoader.getExtensions().extensions) {
		for (const [name, registeredTool] of extension.tools) definitionsByName.set(name, registeredTool.definition);
	}
	return MAYURI_WEB_TOOL_NAMES.flatMap((name) => {
		const definition = definitionsByName.get(name);
		return definition ? [wrapToolDefinition(definition, () => createWorkerExtensionContext(options))] : [];
	});
}

function getOrCreateWorkerDirectory(options: CreateAgentSessionFromServicesOptions): WorkerDirectory {
	const runtime = {
		getModel: () => resolveCurrentModel(options),
		getSkills: () => options.services.resourceLoader.getSkills().skills,
		getExternalTools: (worker: { id: string }) => (worker.id === "research" ? createMayuriWebTools(options) : []),
		modelRegistry: options.services.modelRegistry,
	};
	if (options.services.workerDirectory) {
		options.services.workerDirectory.updateRuntime(runtime);
		return options.services.workerDirectory;
	}
	const directory = new WorkerDirectory({
		cwd: options.services.cwd,
		workers: REPI_NAMED_WORKERS,
		...runtime,
	});
	options.services.workerDirectory = directory;
	return directory;
}

function resolveCustomTools(options: CreateAgentSessionFromServicesOptions): ToolDefinition[] | undefined {
	const customTools = [...(options.customTools ?? [])];
	if (!isTruthyEnvFlag(process.env[DELEGATION_ENV])) return customTools.length > 0 ? customTools : undefined;

	const directory = getOrCreateWorkerDirectory(options);
	const workerTools = [createDelegateTool({ directory }), ...createWorkerControlTools(directory)];
	const existingNames = new Set(customTools.map((tool) => tool.name));
	for (const tool of workerTools) {
		if (existingNames.has(tool.name)) continue;
		customTools.push(withWorkerToolPresentation(createToolDefinitionFromAgentTool(tool), directory));
		existingNames.add(tool.name);
	}
	return customTools;
}

function applyExtensionFlagValues(
	resourceLoader: ResourceLoader,
	extensionFlagValues: Map<string, boolean | string> | undefined,
): AgentSessionRuntimeDiagnostic[] {
	if (!extensionFlagValues) return [];

	const diagnostics: AgentSessionRuntimeDiagnostic[] = [];
	const extensionsResult = resourceLoader.getExtensions();
	const registeredFlags = new Map<string, { type: "boolean" | "string" }>();
	for (const extension of extensionsResult.extensions) {
		for (const [name, flag] of extension.flags) registeredFlags.set(name, { type: flag.type });
	}

	const unknownFlags: string[] = [];
	for (const [name, value] of extensionFlagValues) {
		const flag = registeredFlags.get(name);
		if (!flag) {
			unknownFlags.push(name);
			continue;
		}
		if (flag.type === "boolean") {
			extensionsResult.runtime.flagValues.set(name, true);
			continue;
		}
		if (typeof value === "string") {
			extensionsResult.runtime.flagValues.set(name, value);
			continue;
		}
		diagnostics.push({ type: "error", message: `Extension flag "--${name}" requires a value` });
	}

	if (unknownFlags.length > 0) {
		diagnostics.push({
			type: "error",
			message: `Unknown option${unknownFlags.length === 1 ? "" : "s"}: ${unknownFlags.map((name) => `--${name}`).join(", ")}`,
		});
	}
	return diagnostics;
}

/** Create cwd-bound runtime services. */
export async function createAgentSessionServices(
	options: CreateAgentSessionServicesOptions,
): Promise<AgentSessionServices> {
	const cwd = resolvePath(options.cwd);
	const agentDir = options.agentDir ? resolvePath(options.agentDir) : getAgentDir();
	const authStorage = options.authStorage ?? AuthStorage.create(join(agentDir, "auth.json"));
	const settingsManager = options.settingsManager ?? SettingsManager.create(cwd, agentDir);
	const modelRegistry = options.modelRegistry ?? ModelRegistry.create(authStorage, join(agentDir, "models.json"));
	const workerDirectory = isTruthyEnvFlag(process.env[DELEGATION_ENV])
		? new WorkerDirectory({
				cwd,
				workers: REPI_NAMED_WORKERS,
				getModel: () => undefined,
				modelRegistry,
			})
		: undefined;
	const configuredResourceLoaderOptions = options.resourceLoaderOptions ?? {};
	const extensionFactories = [
		...(configuredResourceLoaderOptions.extensionFactories ?? []),
		...(workerDirectory
			? [
					{
						name: "recode-workers",
						factory: (pi: Parameters<typeof recodeWorkers>[0]) =>
							recodeWorkers(pi, workerDirectory, { settingsPath: join(agentDir, "recode-workers.json") }),
					},
				]
			: []),
	];
	const resourceLoader = new DefaultResourceLoader({
		...configuredResourceLoaderOptions,
		extensionFactories,
		cwd,
		agentDir,
		settingsManager,
	});
	await resourceLoader.reload(options.resourceLoaderReloadOptions);

	const diagnostics: AgentSessionRuntimeDiagnostic[] = [];
	const extensionsResult = resourceLoader.getExtensions();
	for (const { name, config, extensionPath } of extensionsResult.runtime.pendingProviderRegistrations) {
		try {
			modelRegistry.registerProvider(name, config);
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			diagnostics.push({ type: "error", message: `Extension "${extensionPath}" error: ${message}` });
		}
	}
	extensionsResult.runtime.pendingProviderRegistrations = [];
	diagnostics.push(...applyExtensionFlagValues(resourceLoader, options.extensionFlagValues));

	return {
		cwd,
		agentDir,
		authStorage,
		settingsManager,
		modelRegistry,
		resourceLoader,
		workerDirectory,
		diagnostics,
	};
}

/** Create an AgentSession from previously created services. */
export async function createAgentSessionFromServices(
	options: CreateAgentSessionFromServicesOptions,
): Promise<CreateAgentSessionResult> {
	return createAgentSession({
		cwd: options.services.cwd,
		agentDir: options.services.agentDir,
		authStorage: options.services.authStorage,
		settingsManager: options.services.settingsManager,
		modelRegistry: options.services.modelRegistry,
		resourceLoader: options.services.resourceLoader,
		sessionManager: options.sessionManager,
		model: options.model,
		thinkingLevel: options.thinkingLevel,
		scopedModels: options.scopedModels,
		tools: options.tools,
		excludeTools: options.excludeTools,
		noTools: options.noTools,
		customTools: resolveCustomTools(options),
		sessionStartEvent: options.sessionStartEvent,
	});
}
