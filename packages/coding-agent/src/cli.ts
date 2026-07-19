#!/usr/bin/env node
/**
 * CLI entry point for the refactored coding agent.
 * Uses main.ts with AgentSession and new mode modules.
 *
 * Test with: npx tsx src/cli-new.ts [args...]
 */
import { APP_NAME } from "./config.ts";
import { installPiPackageCompatibilityHooks } from "./core/extensions/pi-package-compat.ts";
import { configureHttpDispatcher } from "./core/http-dispatcher.ts";

process.title = APP_NAME;
process.env.PI_CODING_AGENT = "true";
process.emitWarning = (() => {}) as typeof process.emitWarning;

// Register upstream Pi package aliases before loading the application graph.
// This keeps third-party extensions on Recode's single runtime/TUI instance.
await installPiPackageCompatibilityHooks();

// Configure undici's global dispatcher before provider SDKs issue requests.
// Runtime settings are applied once SettingsManager has loaded global/project settings.
configureHttpDispatcher();

const [{ RecodeMemoryRuntime }, { main }, { recodeMemory }, { recodeOpenProvider }] = await Promise.all([
	import("./core/recode-memory/recode-memory-runtime.ts"),
	import("./main.ts"),
	import("./recode-memory.ts"),
	import("./recode-open-provider.ts"),
]);

const memoryRuntime = new RecodeMemoryRuntime();

void main(process.argv.slice(2), {
	extensionFactories: [
		{ name: "recode-open-provider", factory: recodeOpenProvider },
		{ name: "recode-memory", factory: (pi) => recodeMemory(pi, memoryRuntime) },
	],
}).finally(() => memoryRuntime.close());
