import type { InlineExtension } from "../core/extensions/types.ts";
import { repiOpenProvider } from "./providers/open-provider.ts";
import { repiOpenAIOAuth } from "./providers/openai-oauth.ts";

export const repiExtensionFactories: InlineExtension[] = [
	{ name: "repi-open-provider", factory: repiOpenProvider },
	{ name: "repi-openai-oauth", factory: repiOpenAIOAuth },
];
