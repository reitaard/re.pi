#!/usr/bin/env node
import { APP_NAME } from "./config.ts";
import { installPiPackageCompatibilityHooks } from "./core/extensions/pi-package-compat.ts";
import { configureHttpDispatcher } from "./core/http-dispatcher.ts";

process.title = `${APP_NAME}-rpc`;
process.env.PI_CODING_AGENT = "true";
process.emitWarning = (() => {}) as typeof process.emitWarning;

await installPiPackageCompatibilityHooks();
configureHttpDispatcher();

const { main } = await import("./main.ts");
main(["--mode", "rpc", ...process.argv.slice(2)]);
