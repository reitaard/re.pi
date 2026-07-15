import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, test } from "vitest";
import { applyTextEditsToString, applyWorkspaceEdit } from "../src/lsp/edits.ts";
import { fileToUri } from "../src/lsp/utils.ts";

describe("LSP workspace edits", () => {
	test("applies multiple text edits from bottom to top", () => {
		expect(
			applyTextEditsToString("alpha\nbeta\ngamma\n", [
				{ range: { start: { line: 0, character: 0 }, end: { line: 0, character: 5 } }, newText: "one" },
				{ range: { start: { line: 2, character: 0 }, end: { line: 2, character: 5 } }, newText: "three" },
			]),
		).toBe("one\nbeta\nthree\n");
	});

	test("rejects overlapping workspace edits before writing", async () => {
		const root = mkdtempSync(join(tmpdir(), "repi-lsp-edits-"));
		const filePath = join(root, "sample.ts");
		writeFileSync(filePath, "abcdef\n");
		await expect(
			applyWorkspaceEdit(
				{
					changes: {
						[fileToUri(filePath)]: [
							{ range: { start: { line: 0, character: 0 }, end: { line: 0, character: 4 } }, newText: "x" },
							{ range: { start: { line: 0, character: 2 }, end: { line: 0, character: 6 } }, newText: "y" },
						],
					},
				},
				root,
			),
		).rejects.toThrow("Overlapping LSP edits");
		expect(readFileSync(filePath, "utf-8")).toBe("abcdef\n");
	});
});
