#!/usr/bin/env node
/**
 * CLI entry point for the refactored coding agent.
 * Uses main.ts with AgentSession and new mode modules.
 *
 * Test with: npx tsx src/cli-new.ts [args...]
 */
import { APP_NAME } from "./config.ts";
import { configureHttpDispatcher } from "./core/http-dispatcher.ts";
import { RecodeMemoryRuntime } from "./core/recode-memory/recode-memory-runtime.ts";
import { main } from "./main.ts";
import { recodeMemory } from "./recode-memory.ts";
import { recodeOpenProvider } from "./recode-open-provider.ts";

process.title = APP_NAME;
process.env.PI_CODING_AGENT = "true";
process.emitWarning = (() => {}) as typeof process.emitWarning;

// Configure undici's global dispatcher before provider SDKs issue requests.
// Runtime settings are applied once SettingsManager has loaded global/project settings.
configureHttpDispatcher();

const memoryRuntime = new RecodeMemoryRuntime();

void main(process.argv.slice(2), {
	extensionFactories: [
		{ name: "recode-open-provider", factory: recodeOpenProvider },
		{ name: "recode-memory", factory: (pi) => recodeMemory(pi, memoryRuntime) },
	],
}).finally(() => memoryRuntime.close());
