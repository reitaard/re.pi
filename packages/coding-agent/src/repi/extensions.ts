import type { InlineExtension } from "../core/extensions/types.ts";
import { kiokuMemory } from "./memory/extension.ts";
import { KiokuMemoryRuntime } from "./memory/runtime.ts";
import { repiOpenProvider } from "./providers/open-provider.ts";
import { repiOpenAIOAuth } from "./providers/openai-oauth.ts";

const kiokuRuntime = new KiokuMemoryRuntime();
process.once("exit", () => kiokuRuntime.close());

export const repiExtensionFactories: InlineExtension[] = [
	{ name: "repi-open-provider", factory: repiOpenProvider },
	{ name: "repi-openai-oauth", factory: repiOpenAIOAuth },
	{ name: "repi-kioku-memory", factory: (pi) => kiokuMemory(pi, kiokuRuntime) },
];
