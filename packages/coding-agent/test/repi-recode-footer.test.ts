import { stripVTControlCharacters } from "node:util";
import type { Api, Model, Usage } from "@earendil-works/pi-ai";
import { beforeEach, describe, expect, it } from "vitest";
import type { AgentSession } from "../src/core/agent-session.ts";
import type { ReadonlyFooterDataProvider } from "../src/core/footer-data-provider.ts";
import { FooterComponent } from "../src/modes/interactive/components/footer.ts";
import { initTheme, theme } from "../src/modes/interactive/theme/theme.ts";

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

function createSession(options: { withUsage?: boolean; percent?: number } = {}): AgentSession {
	const entries = options.withUsage === false
		? []
		: [
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
			];
	return {
		state: { model: model(), thinkingLevel: "medium" },
		sessionManager: {
			getEntries: () => entries,
			getCwd: () => "C:\\Users\\re_Lax\\Desktop\\chat7\\re.pi",
			getSessionName: () => undefined,
		},
		modelRuntime: { isUsingOAuth: () => true },
		getContextUsage: () => ({ tokens: 24800, contextWindow: 372000, percent: options.percent ?? 6.666 }),
	} as unknown as AgentSession;
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

	it("renders the exact old Recode usage, context, model and status layout", () => {
		const footer = new FooterComponent(createSession(), createFooterData());
		const lines = footer.render(120).map(stripVTControlCharacters);

		expect(lines).toHaveLength(3);
		expect(lines[0]).toContain("re.pi (oauth-test)");
		expect(lines[1]).toContain("↑1.2k");
		expect(lines[1]).toContain("↓340");
		expect(lines[1]).toContain("R800");
		expect(lines[1]).toContain("W20");
		expect(lines[1]).toContain("$0.125 (sub)");
		expect(lines[1]).toContain("6.7%/372k (auto)");
		expect(lines[1]).toContain("(openai-oauth) gpt-5.6-sol • medium");
		expect(lines[1]).not.toContain("ctx ");
		expect(lines[1]).not.toContain("thinking medium");
		expect(lines[2]).toBe("Browser · ready Kioku (記憶): project");
	});

	it("matches the empty-session footer from the restored 0.81.4 screen", () => {
		const footer = new FooterComponent(createSession({ withUsage: false, percent: 0 }), createFooterData());
		const line = stripVTControlCharacters(footer.render(120)[1]!);
		expect(line).toContain("0.0%/372k (auto)");
		expect(line).toContain("(openai-oauth) gpt-5.6-sol • medium");
	});

	it("removes only the auto marker when automatic compaction is disabled", () => {
		const footer = new FooterComponent(createSession({ percent: 40.4 }), createFooterData());
		footer.setAutoCompactEnabled(false);
		const text = footer.render(140).map(stripVTControlCharacters).join("\n");
		expect(text).toContain("40.4%/372k");
		expect(text).not.toContain("(auto)");
	});

	it("uses the Recode footer color in light and dark themes", () => {
		const dark = new FooterComponent(createSession(), createFooterData()).render(120)[0]!;
		initTheme("light");
		const light = new FooterComponent(createSession(), createFooterData()).render(120)[0]!;

		expect(dark).toContain("\x1b[38;");
		expect(light).toContain("\x1b[38;");
		expect(light).not.toBe(dark);
	});
});
