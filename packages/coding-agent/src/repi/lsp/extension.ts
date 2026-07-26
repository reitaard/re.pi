import type { ExtensionAPI } from "../../core/extensions/types.ts";
import { createLspTool } from "../../lsp/tool.ts";

export function repiLsp(pi: ExtensionAPI): void {
	pi.registerTool(createLspTool(process.cwd()));
}
