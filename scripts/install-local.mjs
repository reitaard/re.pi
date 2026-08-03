#!/usr/bin/env node

import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, renameSync, rmSync, symlinkSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join, relative, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { assertReleaseIdentity } from "./release-identity.mjs";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const localInstallDirectoryName = "Recode";

function printUsage() {
	console.log(`Usage: node scripts/install-local.mjs [options]

Builds the current clean checkout and installs its binary into the local Recode
installation directory. No remote release, tag, or publication is performed.

Options:
  --skip-install       Skip npm install --ignore-scripts
  --keep-build         Keep the temporary binary build directory
  --help               Show this help
`);
}

function parseArgs() {
	const options = { keepBuild: false, skipInstall: false };
	for (const arg of process.argv.slice(2)) {
		if (arg === "--help") {
			printUsage();
			process.exit(0);
		}
		if (arg === "--keep-build") {
			options.keepBuild = true;
			continue;
		}
		if (arg === "--skip-install") {
			options.skipInstall = true;
			continue;
		}
		throw new Error(`Unknown option: ${arg}`);
	}
	return options;
}

function run(command, args, options = {}) {
	console.log(`$ ${[command, ...args].join(" ")}`);
	const result = spawnSync(command, args, {
		cwd: options.cwd ?? repositoryRoot,
		env: options.env,
		encoding: "utf8",
		shell: process.platform === "win32",
		stdio: "inherit",
	});
	if (result.error) throw result.error;
	if (result.status !== 0) {
		throw new Error(`Command failed with exit code ${result.status}: ${[command, ...args].join(" ")}`);
	}
}

function readJson(path) {
	return JSON.parse(readFileSync(path, "utf8"));
}

function currentBinaryPlatform() {
	if (process.platform === "win32") {
		if (process.arch === "arm64") return "windows-arm64";
		if (process.arch === "x64") return "windows-x64";
	}
	if (process.platform === "linux") {
		if (process.arch === "arm64") return "linux-arm64";
		if (process.arch === "x64") return "linux-x64";
	}
	throw new Error(`Local binary installation is unsupported on ${process.platform}/${process.arch}`);
}

function packageVersion() {
	const manifest = readJson(join(repositoryRoot, "packages", "coding-agent", "package.json"));
	if (typeof manifest.version !== "string" || manifest.version.length === 0) {
		throw new Error("packages/coding-agent/package.json has no usable version");
	}
	if (manifest.version.includes("/") || manifest.version.includes("\\") || manifest.version === "." || manifest.version === "..") {
		throw new Error(`Unsafe package version for installation path: ${manifest.version}`);
	}
	return manifest.version;
}

function localInstallRoot() {
	if (process.platform === "win32") {
		const localAppData = process.env.LOCALAPPDATA;
		if (!localAppData) throw new Error("LOCALAPPDATA is not set");
		return join(localAppData, localInstallDirectoryName);
	}
	return join(process.env.XDG_DATA_HOME ?? join(homedir(), ".local", "share"), localInstallDirectoryName);
}

function replaceInstallDirectory(sourceDirectory, targetDirectory, version) {
	const parent = dirname(targetDirectory);
	mkdirSync(parent, { recursive: true });
	const stagingDirectory = join(parent, `.recode-staging-${version}-${process.pid}`);
	const backupDirectory = join(parent, `.recode-backup-${version}-${process.pid}`);
	if (existsSync(stagingDirectory) || existsSync(backupDirectory)) {
		throw new Error(`A previous local installation attempt is still present under ${parent}`);
	}

	cpSync(sourceDirectory, stagingDirectory, { recursive: true });
	let movedExisting = false;
	try {
		if (existsSync(targetDirectory)) {
			renameSync(targetDirectory, backupDirectory);
			movedExisting = true;
		}
		renameSync(stagingDirectory, targetDirectory);
	} catch (error) {
		if (movedExisting && !existsSync(targetDirectory) && existsSync(backupDirectory)) {
			renameSync(backupDirectory, targetDirectory);
		}
		rmSync(stagingDirectory, { force: true, recursive: true });
		throw new Error(
			`Could not replace ${targetDirectory}. Stop any running Recode process and retry. ${error instanceof Error ? error.message : String(error)}`,
		);
	}

	if (movedExisting) {
		rmSync(backupDirectory, {
			force: true,
			maxRetries: 5,
			recursive: true,
			retryDelay: 200,
		});
	}
}

function encodePowerShell(command) {
	return Buffer.from(command, "utf16le").toString("base64");
}

function updateWindowsUserPath(installDirectory) {
	const command = `
$installPath = $env:RECODE_LOCAL_INSTALL_PATH
$recodeRoot = [IO.Path]::GetFullPath((Join-Path $env:LOCALAPPDATA '${localInstallDirectoryName}')).TrimEnd('\\')
$current = [Environment]::GetEnvironmentVariable('Path', 'User')
$entries = foreach ($entry in ($current -split ';')) {
  if ([string]::IsNullOrWhiteSpace($entry)) { continue }
  try { $full = [IO.Path]::GetFullPath($entry) } catch { $full = $entry }
  if (-not $full.StartsWith($recodeRoot + '\\', [StringComparison]::OrdinalIgnoreCase)) { $entry }
}
[Environment]::SetEnvironmentVariable('Path', (@($installPath) + @($entries) | Select-Object -Unique) -join ';', 'User')
`;
	run("powershell.exe", [
		"-NoProfile",
		"-NonInteractive",
		"-ExecutionPolicy",
		"Bypass",
		"-EncodedCommand",
		encodePowerShell(command),
	], { env: { ...process.env, RECODE_LOCAL_INSTALL_PATH: installDirectory } });
}

function updateUnixLauncher(installDirectory) {
	const binDirectory = join(process.env.XDG_BIN_HOME ?? join(homedir(), ".local", "bin"));
	mkdirSync(binDirectory, { recursive: true });
	for (const name of ["recode", "recode-maestro"]) {
		const launcher = join(binDirectory, name);
		if (existsSync(launcher)) {
			throw new Error(`Refusing to replace existing launcher: ${launcher}`);
		}
		symlinkSync(join(installDirectory, name), launcher);
	}
}

function verifyBuiltDirectory(directory, platform) {
	const binaryName = platform.startsWith("windows-") ? "recode.exe" : "recode";
	const binaryPath = join(directory, binaryName);
	if (!existsSync(binaryPath)) throw new Error(`Built binary is missing: ${binaryPath}`);
	if (!existsSync(join(directory, "recode-maestro" + (platform.startsWith("windows-") ? ".exe" : "")))) {
		throw new Error(`Built maestro binary is missing from ${directory}`);
	}
	if (!existsSync(join(directory, "package.json"))) throw new Error(`Built package manifest is missing: ${directory}`);
	return binaryPath;
}

const options = parseArgs();
if (process.cwd() !== repositoryRoot) {
	console.log(`Using repository root: ${repositoryRoot}`);
}
const platform = currentBinaryPlatform();
const identity = assertReleaseIdentity({ mode: "branch", root: repositoryRoot });
const version = packageVersion();
if (identity.version !== version) {
	throw new Error(`Source package version changed during identity validation: ${identity.version} -> ${version}`);
}
console.log(`Verified current Recode checkout: ${version} ${identity.commit}`);

const buildDirectory = mkdtempSync(join(repositoryRoot, ".recode-local-install-"));
const buildArgument = relative(repositoryRoot, buildDirectory).replaceAll("\\", "/");
const outputPlatformDirectory = join(buildDirectory, platform);
let installedBinary;
try {
	if (!options.skipInstall) run("npm", ["install", "--ignore-scripts"]);
	run("npm", ["run", "clean"]);
	run("npm", ["run", "build:release"]);
	run("bash", [
		"./scripts/build-binaries.sh",
		"--skip-install",
		"--skip-deps",
		"--skip-build",
		"--skip-archives",
		"--platform",
		platform,
		"--out",
		buildArgument,
	]);

	const binaryPath = verifyBuiltDirectory(outputPlatformDirectory, platform);
	const installedDirectory = join(localInstallRoot(), version);
	replaceInstallDirectory(outputPlatformDirectory, installedDirectory, version);
	installedBinary = join(installedDirectory, platform.startsWith("windows-") ? "recode.exe" : "recode");
	if (process.platform === "win32") updateWindowsUserPath(installedDirectory);
	else updateUnixLauncher(installedDirectory);

	console.log(`Installed Recode ${version} from ${identity.commit}`);
	console.log(`  Binary: ${installedBinary}`);
	console.log(`  Source artifact: ${binaryPath}`);
	console.log("  Open a new terminal for the updated PATH to take effect.");
	run(installedBinary, ["--version"]);
} finally {
	if (options.keepBuild) console.log(`Build directory kept: ${buildDirectory}`);
	else rmSync(buildDirectory, { force: true, recursive: true });
}
