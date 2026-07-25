import { stripVTControlCharacters } from "node:util";
import type { Api, Model, Usage } from "@earendil-works/pi-ai";
import { beforeEach, describe, expect, it } from "vitest";
import type { ReadonlyFooterDataProvider } from "../src/core/footer-data-provider.ts";
import type { ModelRegistry } from "../src/core/model-registry.ts";
import type { ReadonlySessionManager } from "../src/core/session-manager.ts";
import { initTheme, theme } from "../src/modes/interactive/theme/theme.ts";
import { RecodeFooter, type RecodeFooterState } from "../src/repi/ui/recode-footer.ts";

const ZERO_COST = { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 };

function usage(overrides: Partial<Usage> = {}): Usage {
	return {
		input: 1200,
		output: 340,
		cacheRead: 800,
		cacheWrite: 20,
		totalTokens: 2360,
		cost: { ...ZERO_COST, total: 0.125 },
		...overrides,
	};
}

function model(): Model<Api> {
	return {
		id: "gpt-5.6-sol",
		name: "GPT-5.6 Sol (OAuth)",
		api: "openai-responses",
		provider: "openai-oauth",
		baseUrl: "http://127.0.0.1:10531/v1",
		reasoning: true,
		thinkingLevelMap: {
			minimal: "minimal",
			low: "low",
			medium: "medium",
			high: "high",
			xhigh: "xhigh",
			max: "max",
		},
		input: ["text", "image"],
		cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
		contextWindow: 372000,
		maxTokens: 128000,
	};
}

function createState(): RecodeFooterState {
	const sessionManager = {
		getEntries: () => [
			{
				type: "message",
				message: {
					role: "assistant",
					content: [],
					api: "openai-responses",
					provider: "openai-oauth",
					model: "gpt-5.6-sol",
					usage: usage(),
					stopReason: "stop",
					timestamp: Date.now(),
				},
			},
		],
		getSessionName: () => undefined,
	} as unknown as ReadonlySessionManager;
	const modelRegistry = {
		isUsingOAuth: () => true,
	} as unknown as ModelRegistry;
	return {
		cwd: "C:\\Users\\re_Lax\\Desktop\\chat7\\re.pi",
		sessionManager,
		modelRegistry,
		model: model(),
		thinkingLevel: "medium",
		getContextUsage: () => ({ tokens: 24800, contextWindow: 372000, percent: 6.666 }),
	};
}

function createFooterData(): ReadonlyFooterDataProvider {
	return {
		getGitBranch: () => "oauth-test",
		getExtensionStatuses: () =>
			new Map([
				["repi-kioku-memory", theme.fg("success", "Kioku (記憶): project")],
				["browser", theme.fg("success", "Browser · ready")],
			]),
		getAvailableProviderCount: () => 2,
		onBranchChange: () => () => {},
	} as ReadonlyFooterDataProvider;
}

describe("Recode footer parity", () => {
	beforeEach(() => initTheme("dark"));

	it("renders path, usage, OAuth model state, and extension statuses", () => {
		const state = createState();
		const footer = new RecodeFooter(() => state, createFooterData(), theme);
		const lines = footer.render(120).map(stripVTControlCharacters);

		expect(lines).toHaveLength(3);
		expect(lines[0]).toContain("re.pi (oauth-test)");
		expect(lines[1]).toContain("↑1.2k");
		expect(lines[1]).toContain("↓340");
		expect(lines[1]).toContain("R800");
		expect(lines[1]).toContain("W20");
		expect(lines[1]).toContain("$0.125 (sub)");
		expect(lines[1]).toContain("ctx 25k 6.7%");
		expect(lines[1]).toContain("(openai-oauth) gpt-5.6-sol • thinking medium");
		expect(lines[2]).toBe("Browser · ready Kioku (記憶): project");
	});

	it("shows the compaction hint at the Recode threshold", () => {
		const state = createState();
		state.getContextUsage = () => ({ tokens: 150000, contextWindow: 372000, percent: 40.4 });
		const footer = new RecodeFooter(() => state, createFooterData(), theme);
		const text = footer.render(140).map(stripVTControlCharacters).join("\n");

		expect(text).toContain("ctx 150k 40.4% (compact?)");
	});

	it("uses the fixed Recode footer color in light and dark themes", () => {
		const state = createState();
		const dark = new RecodeFooter(() => state, createFooterData(), theme).render(120)[0]!;
		initTheme("light");
		const light = new RecodeFooter(() => state, createFooterData(), theme).render(120)[0]!;

		expect(dark).toContain("\x1b[38;");
		expect(light).toContain("\x1b[38;");
		expect(light).not.toBe(dark);
	});
});
