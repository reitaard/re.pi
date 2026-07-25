import { describe, expect, it } from "vitest";
import { shouldHandleRepiSelfUpdate } from "../src/repi/update/self-update.ts";

describe("Recode update command routing", () => {
	it("handles self-update forms", () => {
		expect(shouldHandleRepiSelfUpdate(["update"])).toBe(true);
		expect(shouldHandleRepiSelfUpdate(["update", "--self"])).toBe(true);
		expect(shouldHandleRepiSelfUpdate(["update", "self"])).toBe(true);
		expect(shouldHandleRepiSelfUpdate(["update", "recode"])).toBe(true);
		expect(shouldHandleRepiSelfUpdate(["update", "pi"])).toBe(true);
		expect(shouldHandleRepiSelfUpdate(["update", "--all"])).toBe(true);
		expect(shouldHandleRepiSelfUpdate(["update", "--self", "--extensions"])).toBe(true);
		expect(shouldHandleRepiSelfUpdate(["update", "self", "--extensions"])).toBe(true);
		expect(shouldHandleRepiSelfUpdate(["update", "recode", "--extensions"])).toBe(true);
	});

	it("delegates extension, model, help, and named-package updates", () => {
		expect(shouldHandleRepiSelfUpdate(["update", "--extensions"])).toBe(false);
		expect(shouldHandleRepiSelfUpdate(["update", "--models"])).toBe(false);
		expect(shouldHandleRepiSelfUpdate(["update", "--help"])).toBe(false);
		expect(shouldHandleRepiSelfUpdate(["update", "--extension", "npm:example"])).toBe(false);
		expect(shouldHandleRepiSelfUpdate(["update", "npm:example"])).toBe(false);
		expect(shouldHandleRepiSelfUpdate(["list"])).toBe(false);
	});
});
