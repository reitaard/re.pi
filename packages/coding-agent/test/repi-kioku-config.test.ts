import { describe, expect, it } from "vitest";
import {
	DEFAULT_KIOKU_MEMORY_CONFIG,
	normalizeKiokuMemoryConfig,
	resolveAutomaticKiokuScope,
} from "../src/repi/memory/extension.ts";

describe("RePi Kioku configuration", () => {
	it("uses project-only recall by default", () => {
		expect(normalizeKiokuMemoryConfig(undefined)).toEqual(DEFAULT_KIOKU_MEMORY_CONFIG);
		expect(resolveAutomaticKiokuScope(DEFAULT_KIOKU_MEMORY_CONFIG, true)).toBe("project");
		expect(resolveAutomaticKiokuScope(DEFAULT_KIOKU_MEMORY_CONFIG, false)).toBeUndefined();
	});

	it("migrates legacy globalRecall without enabling impossible combinations", () => {
		expect(normalizeKiokuMemoryConfig({ globalRecall: true })).toMatchObject({
			globalAccess: true,
			globalAutoRecall: true,
		});
		expect(normalizeKiokuMemoryConfig({ globalAccess: false, globalAutoRecall: true })).toMatchObject({
			globalAccess: false,
			globalAutoRecall: false,
		});
	});

	it("combines project and global automatic recall only when both are enabled", () => {
		const config = normalizeKiokuMemoryConfig({
			autoRecall: true,
			globalAccess: true,
			globalAutoRecall: true,
		});
		expect(resolveAutomaticKiokuScope(config, true)).toBe("both");
		expect(resolveAutomaticKiokuScope({ ...config, autoRecall: false }, true)).toBe("global");
	});

	it("bounds user-controlled recall limits", () => {
		expect(normalizeKiokuMemoryConfig({ maxResults: 99, maxInjectedCharacters: 10 })).toMatchObject({
			maxResults: 20,
			maxInjectedCharacters: 1000,
		});
	});
});
