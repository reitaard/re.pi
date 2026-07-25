import {
	getPackageDir,
	getSelfUpdateCommand,
	getSelfUpdateUnavailableInstruction,
	type SelfUpdateCommand,
} from "../../config.ts";
import { spawnProcess, spawnProcessSync, waitForChildProcess } from "../../utils/child-process.ts";
import {
	cleanupWindowsSelfUpdateQuarantine,
	quarantineWindowsNativeDependencies,
} from "../../utils/windows-self-update.ts";
import { getLatestRepiRelease, isNewerRepiVersion } from "./release.ts";

export interface RepiUpdateCommandResult {
	handled: boolean;
	exitCode: number;
}

const SELF_TARGETS = new Set(["self", "recode", "pi"]);

function positionalArguments(args: string[]): string[] {
	const values: string[] = [];
	for (let index = 0; index < args.length; index++) {
		const arg = args[index];
		if (arg === "--extension") {
			index += 1;
			continue;
		}
		if (!arg.startsWith("-")) values.push(arg);
	}
	return values;
}

export function shouldHandleRepiSelfUpdate(args: string[]): boolean {
	if (args[0] !== "update") return false;
	const rest = args.slice(1);
	if (rest.includes("-h") || rest.includes("--help") || rest.includes("--models")) return false;
	if (rest.includes("--extension")) return false;

	const positional = positionalArguments(rest);
	if (positional.some((value) => !SELF_TARGETS.has(value))) return false;
	const selfRequested =
		rest.includes("--self") ||
		rest.includes("--all") ||
		positional.length > 0 ||
		(!rest.includes("--extensions") && positional.length === 0);
	return selfRequested;
}

function npmExecutable(): string {
	return process.env.REPI_NPM_COMMAND?.trim() || "npm";
}

function formatCommand(command: string, args: string[]): string {
	return [command, ...args].map((value) => (/\s/.test(value) ? `"${value}"` : value)).join(" ");
}

async function runInherited(command: string, args: string[]): Promise<void> {
	const child = spawnProcess(command, args, { stdio: "inherit" });
	const code = await waitForChildProcess(child);
	if (code !== 0) throw new Error(`${formatCommand(command, args)} exited with code ${code ?? "unknown"}`);
}

async function runSelfUpdateCommand(command: SelfUpdateCommand): Promise<void> {
	console.log(`Updating Recode with ${command.display}...`);
	for (const step of command.steps ?? [command]) {
		await runInherited(step.command, step.args);
	}
}

function runningFromInstalledPackage(): boolean {
	return getPackageDir().replace(/\\/g, "/").toLowerCase().includes("/node_modules/");
}

function prepareWindowsInstalledPackage(): void {
	if (process.platform !== "win32" || !runningFromInstalledPackage()) return;
	const packageDir = getPackageDir();
	cleanupWindowsSelfUpdateQuarantine(packageDir);
	quarantineWindowsNativeDependencies(packageDir);
}

async function updateExtensionsFirst(originalArgs: string[]): Promise<void> {
	if (!originalArgs.includes("--all") && !originalArgs.includes("--extensions")) return;
	const entrypoint = process.argv[1];
	if (!entrypoint) throw new Error("Cannot locate the Recode entrypoint for extension updates");
	const trustArgs = originalArgs.filter(
		(arg) => arg === "--approve" || arg === "-a" || arg === "--no-approve" || arg === "-na",
	);
	await runInherited(process.execPath, [entrypoint, "update", "--extensions", ...trustArgs]);
}

function verifyPublishedVersion(expectedVersion: string): string | undefined {
	const result = spawnProcessSync("recode", ["--version"], {
		encoding: "utf8",
		stdio: ["ignore", "pipe", "pipe"],
	});
	if (result.status !== 0) return undefined;
	const output = result.stdout.trim();
	return output.includes(expectedVersion) ? output : undefined;
}

function resolveSelfUpdateCommand(packageName: string, installSpec: string): SelfUpdateCommand {
	const target = { packageName, installSpec };
	const managedCommand = getSelfUpdateCommand(packageName, undefined, target);
	if (managedCommand) return managedCommand;

	if (!runningFromInstalledPackage()) {
		const command = npmExecutable();
		const args = ["install", "-g", "--ignore-scripts", "--min-release-age=0", installSpec];
		return { command, args, display: formatCommand(command, args) };
	}

	throw new Error(getSelfUpdateUnavailableInstruction(packageName, undefined, target));
}

export async function handleRepiSelfUpdateCommand(args: string[]): Promise<RepiUpdateCommandResult> {
	if (!shouldHandleRepiSelfUpdate(args)) return { handled: false, exitCode: 0 };

	const currentVersion = process.env.REPI_VERSION;
	const packageName = process.env.REPI_PACKAGE_NAME;
	if (!currentVersion || !packageName) {
		console.error("Error: RePi build metadata is missing; refusing to use the self updater.");
		return { handled: true, exitCode: 1 };
	}

	try {
		await updateExtensionsFirst(args.slice(1));
		const release = await getLatestRepiRelease({ packageName });
		if (!release) throw new Error(`No stable RePi release is available for ${packageName}`);
		const force = args.includes("--force");
		if (!force && !isNewerRepiVersion(release.version, currentVersion)) {
			console.log(`Recode is already up to date (${currentVersion})`);
			return { handled: true, exitCode: 0 };
		}

		if (release.note) {
			console.log("\nUpdate note\n");
			console.log(release.note);
			console.log();
		}

		const command = resolveSelfUpdateCommand(packageName, release.installSpec);
		prepareWindowsInstalledPackage();
		await runSelfUpdateCommand(command);

		const verified = verifyPublishedVersion(release.version);
		if (verified) {
			console.log(`Updated Recode from ${currentVersion} to ${release.version}`);
		} else {
			console.log(
				`Installed Recode ${release.version}. Restart the terminal if the recode command still resolves to an older link.`,
			);
		}
		return { handled: true, exitCode: 0 };
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		console.error(`Error: ${message}`);
		console.error(`No upstream Pi package was installed. RePi updates only target ${packageName}.`);
		return { handled: true, exitCode: 1 };
	}
}
