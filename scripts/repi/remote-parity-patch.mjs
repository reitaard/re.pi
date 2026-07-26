import { execFileSync } from "node:child_process";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import * as ts from "typescript";

const LEGACY_REF = "origin/oauth-test";

function run(command, args, options = {}) {
	return execFileSync(command, args, { encoding: "utf8", ...options });
}

function legacyFile(path) {
	return run("git", ["show", `${LEGACY_REF}:${path}`]);
}

async function read(path) {
	return readFile(path, "utf8");
}

async function write(path, content) {
	await mkdir(dirname(path), { recursive: true });
	await writeFile(path, content, "utf8");
}

function sourceFile(path, content) {
	return ts.createSourceFile(path, content, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
}

function findInterface(content, path, name) {
	const file = sourceFile(path, content);
	const node = file.statements.find((statement) => ts.isInterfaceDeclaration(statement) && statement.name.text === name);
	if (!node) throw new Error(`Missing interface ${name} in ${path}`);
	return { file, node };
}

function findClass(content, path, name) {
	const file = sourceFile(path, content);
	const node = file.statements.find((statement) => ts.isClassDeclaration(statement) && statement.name?.text === name);
	if (!node) throw new Error(`Missing class ${name} in ${path}`);
	return { file, node };
}

function findMethod(content, path, className, methodName) {
	const { file, node: classNode } = findClass(content, path, className);
	const method = classNode.members.find(
		(member) => ts.isMethodDeclaration(member) && ts.isIdentifier(member.name) && member.name.text === methodName,
	);
	if (!method) throw new Error(`Missing ${className}.${methodName} in ${path}`);
	return { file, node: method };
}

function findProperty(content, path, className, propertyName) {
	const { file, node: classNode } = findClass(content, path, className);
	const property = classNode.members.find(
		(member) => ts.isPropertyDeclaration(member) && ts.isIdentifier(member.name) && member.name.text === propertyName,
	);
	return property ? { file, node: property } : undefined;
}

function nodeText(content, file, node) {
	return content.slice(node.getStart(file), node.getEnd());
}

function replaceMethod(target, targetPath, className, methodName, replacement) {
	const { file, node } = findMethod(target, targetPath, className, methodName);
	return target.slice(0, node.getStart(file)) + replacement + target.slice(node.getEnd());
}

function insertMethodsBefore(target, targetPath, className, anchorName, methods) {
	const { file, node } = findMethod(target, targetPath, className, anchorName);
	const position = node.getStart(file);
	return target.slice(0, position) + methods.join("\n\n\t") + "\n\n\t" + target.slice(position);
}

function replaceOnce(content, before, after, label) {
	if (content.includes(after)) return content;
	if (!content.includes(before)) throw new Error(`Missing patch anchor: ${label}`);
	return content.replace(before, after);
}

async function restoreLegacyLsp() {
	const paths = run("git", ["ls-tree", "-r", "--name-only", LEGACY_REF, "packages/coding-agent/src/lsp"])
		.split(/\r?\n/)
		.filter(Boolean);
	for (const path of paths) {
		let content = legacyFile(path);
		content = content
			.replaceAll("@reitaard/repi-tui", "@earendil-works/pi-tui")
			.replaceAll("@reitaard/repi-agent-core", "@earendil-works/pi-agent-core")
			.replaceAll("@reitaard/repi-ai", "@earendil-works/pi-ai");
		await write(path, content);
	}
	const mcpSummary = "packages/coding-agent/src/modes/interactive/mcp-startup-summary.ts";
	await write(mcpSummary, legacyFile(mcpSummary));
}

async function restoreNativeFooter() {
	const path = "packages/coding-agent/src/modes/interactive/components/footer.ts";
	let content = await read(path);
	content = content.replaceAll('theme.fg("footer",', 'theme.fg("dim",');
	await write(path, content);
}

async function patchSettingsManager() {
	const path = "packages/coding-agent/src/core/settings-manager.ts";
	const legacy = legacyFile(path)
		.replaceAll("@reitaard/repi-agent-core", "@earendil-works/pi-agent-core")
		.replaceAll("@reitaard/repi-ai", "@earendil-works/pi-ai");
	let target = await read(path);

	if (!target.includes("export interface LspSettings")) {
		const legacyInterface = findInterface(legacy, path, "LspSettings");
		const interfaceText = nodeText(legacy, legacyInterface.file, legacyInterface.node);
		const trustAnchor = "export type DefaultProjectTrust";
		const position = target.indexOf(trustAnchor);
		if (position < 0) throw new Error("Missing DefaultProjectTrust anchor");
		target = `${target.slice(0, position)}${interfaceText}\n\n${target.slice(position)}`;
	}

	if (!target.includes("\tlsp?: LspSettings;")) {
		target = replaceOnce(
			target,
			"\tmarkdown?: MarkdownSettings;\n\twarnings?: WarningSettings;\n\tsessionDir?: string;",
			"\tmarkdown?: MarkdownSettings;\n\twarnings?: WarningSettings;\n\tlsp?: LspSettings;\n\tsessionDir?: string;",
			"Settings.lsp",
		);
	}

	const methodNames = [
		"getLspSettings",
		"setLspEnabled",
		"setLspmuxEnabled",
		"setLspProjectOnly",
		"setLspServerEnabled",
	];
	const missing = methodNames.filter((name) => !target.includes(`\t${name}(`));
	if (missing.length > 0) {
		const methods = missing.map((name) => {
			const legacyMethod = findMethod(legacy, path, "SettingsManager", name);
			return nodeText(legacy, legacyMethod.file, legacyMethod.node);
		});
		target = insertMethodsBefore(target, path, "SettingsManager", "getRetrySettings", methods);
	}

	await write(path, target);
}

async function patchInteractiveMode() {
	const path = "packages/coding-agent/src/modes/interactive/interactive-mode.ts";
	const legacy = legacyFile(path);
	let target = await read(path);

	if (!target.includes('from "../../lsp/index.ts"')) {
		target = replaceOnce(
			target,
			'import { hasTrustRequiringProjectResources, ProjectTrustStore } from "../../core/trust-manager.ts";\n',
			'import { hasTrustRequiringProjectResources, ProjectTrustStore } from "../../core/trust-manager.ts";\nimport { getLspLifecycleStatuses, loadLspConfig } from "../../lsp/index.ts";\n',
			"interactive LSP imports",
		);
	}
	if (!target.includes('from "./mcp-startup-summary.ts"')) {
		target = replaceOnce(
			target,
			'import { UserMessageSelectorComponent } from "./components/user-message-selector.ts";\n',
			'import { UserMessageSelectorComponent } from "./components/user-message-selector.ts";\nimport { getConfiguredMcpServerNames } from "./mcp-startup-summary.ts";\n',
			"interactive MCP import",
		);
	}
	if (!target.includes("private mcpStartupStatus:")) {
		target = replaceOnce(
			target,
			"\tprivate anthropicSubscriptionWarningShown = false;\n",
			"\tprivate anthropicSubscriptionWarningShown = false;\n\tprivate mcpStartupStatus: string | undefined = undefined;\n",
			"MCP startup field",
		);
	}

	const legacyResources = findMethod(legacy, path, "InteractiveMode", "showLoadedResources");
	let resourcesText = nodeText(legacy, legacyResources.file, legacyResources.node)
		.replaceAll('"toolSuccessStatus"', '"success"')
		.replaceAll('"toolErrorStatus"', '"error"');
	target = replaceMethod(target, path, "InteractiveMode", "showLoadedResources", resourcesText);

	const legacyStatus = findMethod(legacy, path, "InteractiveMode", "setExtensionStatus");
	const statusText = nodeText(legacy, legacyStatus.file, legacyStatus.node);
	target = replaceMethod(target, path, "InteractiveMode", "setExtensionStatus", statusText);

	await write(path, target);
}

async function installLspExtension() {
	const extensionPath = "packages/coding-agent/src/repi/lsp/extension.ts";
	await write(
		extensionPath,
		`import type { ExtensionAPI } from "../../core/extensions/types.ts";\nimport { createLspTool } from "../../lsp/tool.ts";\n\nexport function repiLsp(pi: ExtensionAPI): void {\n\tpi.registerTool(createLspTool(process.cwd()));\n}\n`,
	);

	const aggregatorPath = "packages/coding-agent/src/repi/extensions.ts";
	let aggregator = await read(aggregatorPath);
	if (!aggregator.includes('from "./lsp/extension.ts"')) {
		aggregator = replaceOnce(
			aggregator,
			'import { repiWorkers } from "./delegation/extension.ts";\n',
			'import { repiWorkers } from "./delegation/extension.ts";\nimport { repiLsp } from "./lsp/extension.ts";\n',
			"RePi LSP extension import",
		);
	}
	if (!aggregator.includes('{ name: "repi-lsp"')) {
		aggregator = replaceOnce(
			aggregator,
			'\t{ name: "repi-workers", factory: repiWorkers, hidden: true },\n',
			'\t{ name: "repi-workers", factory: repiWorkers, hidden: true },\n\t{ name: "repi-lsp", factory: repiLsp, hidden: true },\n',
			"RePi LSP extension registration",
		);
	}
	await write(aggregatorPath, aggregator);
}

async function main() {
	await restoreLegacyLsp();
	await restoreNativeFooter();
	await patchSettingsManager();
	await patchInteractiveMode();
	await installLspExtension();

	// Ensure no legacy package namespace survives in the restored subsystem.
	for (const entry of await readdir("packages/coding-agent/src/lsp", { withFileTypes: true })) {
		if (!entry.isFile() || !entry.name.endsWith(".ts")) continue;
		const path = join("packages/coding-agent/src/lsp", entry.name);
		const content = await read(path);
		if (content.includes("@reitaard/repi-")) throw new Error(`Legacy package import remains in ${path}`);
	}
}

await main();
