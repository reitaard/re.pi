import { describe, expect, it } from "vitest";
import { mapPiPackageSpecifier } from "../src/core/extensions/pi-package-compat.ts";

describe("Pi package compatibility mapping", () => {
	it.each(["@earendil-works", "@mariozechner"])("maps the %s Pi package scope", (scope) => {
		expect(mapPiPackageSpecifier(`${scope}/pi-ai`)).toBe("@reitaard/repi-ai/compat");
		expect(mapPiPackageSpecifier(`${scope}/pi-ai/compat`)).toBe("@reitaard/repi-ai/compat");
		expect(mapPiPackageSpecifier(`${scope}/pi-ai/oauth`)).toBe("@reitaard/repi-ai/oauth");
		expect(mapPiPackageSpecifier(`${scope}/pi-agent-core`)).toBe("@reitaard/repi-agent-core");
		expect(mapPiPackageSpecifier(`${scope}/pi-agent-core/node`)).toBe("@reitaard/repi-agent-core/node");
		expect(mapPiPackageSpecifier(`${scope}/pi-coding-agent`)).toBe("@reitaard/repi-coding-agent");
		expect(mapPiPackageSpecifier(`${scope}/pi-coding-agent/workers`)).toBe("@reitaard/repi-coding-agent/workers");
		expect(mapPiPackageSpecifier(`${scope}/pi-tui`)).toBe("@reitaard/repi-tui");
	});

	it("leaves unrelated packages untouched", () => {
		expect(mapPiPackageSpecifier("typebox")).toBe("typebox");
		expect(mapPiPackageSpecifier("@modelcontextprotocol/sdk")).toBe("@modelcontextprotocol/sdk");
		expect(mapPiPackageSpecifier("@earendil-works/not-pi")).toBe("@earendil-works/not-pi");
	});
});
