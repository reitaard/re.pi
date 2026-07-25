#!/usr/bin/env node
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { deriveRepiBuildInfo } from "./version-core.mjs";

const args = process.argv.slice(2);
const outputIndex = args.indexOf("--output");
const outputPath = outputIndex >= 0 ? args[outputIndex + 1] : undefined;
const printOnly = args.includes("--print");

if (outputIndex >= 0 && !outputPath) {
	throw new Error("--output requires a path");
}

const rootDir = process.cwd();
const info = deriveRepiBuildInfo(rootDir);

if (printOnly) {
	process.stdout.write(`${info.version}\n`);
}

if (outputPath) {
	const absolute = resolve(rootDir, outputPath);
	mkdirSync(dirname(absolute), { recursive: true });
	writeFileSync(absolute, `${JSON.stringify(info, null, "\t")}\n`, "utf8");
	process.stdout.write(`Generated ${outputPath}: ${info.version}\n`);
}

if (!printOnly && !outputPath) {
	process.stdout.write(`${JSON.stringify(info, null, "\t")}\n`);
}
