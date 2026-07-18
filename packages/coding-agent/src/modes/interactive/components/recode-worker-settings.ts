import {
	type Component,
	Container,
	fuzzyFilter,
	getKeybindings,
	Input,
	truncateToWidth,
	visibleWidth,
	wrapTextWithAnsi,
} from "@reitaard/repi-tui";
import type { WorkerConversationSnapshot, WorkerDescriptor } from "../../../core/delegation/worker-directory.ts";
import { theme } from "../theme/theme.ts";
import { DynamicBorder } from "./dynamic-border.ts";
import { workerForeground } from "./recode-worker-indicator.ts";

export type RecodeWorkerSettingAction =
	| "chat"
	| "close"
	| "status"
	| "model"
	| "thinking"
	| "tokens"
	| "tools"
	| "prompt";

export interface RecodeWorkerSettingId {
	workerId: string;
	action: RecodeWorkerSettingAction;
}

export interface RecodeWorkerSettingsOptions {
	workers: readonly WorkerDescriptor[];
	directChats?: ReadonlyMap<string, WorkerConversationSnapshot>;
	modelValues: readonly string[];
	maxVisible: number;
}

interface WorkerSettingItem {
	id: string;
	workerId: string;
	workerName: string;
	label: string;
	description: string;
	currentValue: string;
	values: string[];
	searchText: string;
}

function settingId(workerId: string, action: RecodeWorkerSettingAction): string {
	return `${workerId}:${action}`;
}

export function parseWorkerSettingId(value: string): RecodeWorkerSettingId | undefined {
	const separator = value.indexOf(":");
	if (separator < 1) return undefined;
	const workerId = value.slice(0, separator);
	const action = value.slice(separator + 1) as RecodeWorkerSettingAction;
	if (!["chat", "close", "status", "model", "thinking", "tokens", "tools", "prompt"].includes(action)) {
		return undefined;
	}
	return { workerId, action };
}

class GroupedWorkerSettingsList implements Component {
	private readonly items: WorkerSettingItem[];
	private filteredItems: WorkerSettingItem[];
	private readonly maxVisible: number;
	private readonly onChange: (id: string, value: string) => void;
	private readonly onCancel: () => void;
	private readonly searchInput = new Input();
	private selectedIndex = 0;

	constructor(
		items: WorkerSettingItem[],
		maxVisible: number,
		onChange: (id: string, value: string) => void,
		onCancel: () => void,
	) {
		this.items = items;
		this.filteredItems = items;
		this.maxVisible = maxVisible;
		this.onChange = onChange;
		this.onCancel = onCancel;
	}

	render(width: number): string[] {
		const lines = [...this.searchInput.render(width), ""];
		if (this.filteredItems.length === 0) {
			lines.push(theme.fg("muted", "  No matching worker settings"));
			this.addHint(lines, width);
			return lines;
		}

		const startIndex = Math.max(
			0,
			Math.min(this.selectedIndex - Math.floor(this.maxVisible / 2), this.filteredItems.length - this.maxVisible),
		);
		const endIndex = Math.min(startIndex + this.maxVisible, this.filteredItems.length);
		const maxLabelWidth = Math.min(22, Math.max(...this.items.map((item) => visibleWidth(item.label))));
		let renderedWorkerId: string | undefined;

		for (let index = startIndex; index < endIndex; index++) {
			const item = this.filteredItems[index];
			if (!item) continue;
			if (item.workerId !== renderedWorkerId) {
				if (renderedWorkerId !== undefined) lines.push("");
				lines.push(
					`  ${theme.bold(workerForeground(item.workerId, "identity", item.workerName, theme))}`,
					`  ${workerForeground(item.workerId, "rail", "─".repeat(Math.max(8, visibleWidth(item.workerName))), theme)}`,
				);
				renderedWorkerId = item.workerId;
			}

			const selected = index === this.selectedIndex;
			const prefix = selected ? theme.fg("accent", "→ ") : workerForeground(item.workerId, "rail", "• ", theme);
			const label = item.label + " ".repeat(Math.max(0, maxLabelWidth - visibleWidth(item.label)));
			const coloredLabel = workerForeground(item.workerId, "identity", label, theme);
			const usedWidth = 2 + visibleWidth(prefix) + maxLabelWidth + 2;
			const value = truncateToWidth(item.currentValue, Math.max(1, width - usedWidth - 2), "");
			lines.push(
				truncateToWidth(
					`  ${prefix}${selected ? theme.bold(coloredLabel) : coloredLabel}  ${workerForeground(item.workerId, "text", value, theme)}`,
					width,
					"",
				),
			);
		}

		if (startIndex > 0 || endIndex < this.filteredItems.length) {
			lines.push(theme.fg("muted", `  (${this.selectedIndex + 1}/${this.filteredItems.length})`));
		}
		const selected = this.filteredItems[this.selectedIndex];
		if (selected) {
			lines.push("");
			for (const line of wrapTextWithAnsi(selected.description, Math.max(1, width - 4))) {
				lines.push(theme.fg("dim", `  ${line}`));
			}
		}
		this.addHint(lines, width);
		return lines;
	}

	updateValue(id: string, value: string): void {
		const item = this.items.find((candidate) => candidate.id === id);
		if (item) item.currentValue = value;
	}

	handleInput(data: string): void {
		const keybindings = getKeybindings();
		if (keybindings.matches(data, "tui.select.up")) {
			if (this.filteredItems.length > 0) {
				this.selectedIndex = this.selectedIndex === 0 ? this.filteredItems.length - 1 : this.selectedIndex - 1;
			}
			return;
		}
		if (keybindings.matches(data, "tui.select.down")) {
			if (this.filteredItems.length > 0) {
				this.selectedIndex = this.selectedIndex === this.filteredItems.length - 1 ? 0 : this.selectedIndex + 1;
			}
			return;
		}
		if (keybindings.matches(data, "tui.select.confirm") || data === " ") {
			this.activateSelected();
			return;
		}
		if (keybindings.matches(data, "tui.select.cancel")) {
			this.onCancel();
			return;
		}
		const sanitized = data.replace(/ /g, "");
		if (!sanitized) return;
		this.searchInput.handleInput(sanitized);
		this.filteredItems = fuzzyFilter(
			this.items,
			this.searchInput.getValue(),
			(item) => `${item.workerName} ${item.label} ${item.searchText}`,
		);
		this.selectedIndex = 0;
	}

	invalidate(): void {
		this.searchInput.invalidate?.();
	}

	private activateSelected(): void {
		const item = this.filteredItems[this.selectedIndex];
		if (!item || item.values.length === 0) return;
		const currentIndex = item.values.indexOf(item.currentValue);
		const nextValue = item.values[(currentIndex + 1) % item.values.length];
		if (!nextValue) return;
		item.currentValue = nextValue;
		this.onChange(item.id, nextValue);
	}

	private addHint(lines: string[], width: number): void {
		lines.push(
			"",
			truncateToWidth(theme.fg("dim", "  Type to search · Enter/Space to open or change · Esc to cancel"), width),
		);
	}
}

export class RecodeWorkerSettingsComponent extends Container {
	private readonly settingsList: GroupedWorkerSettingsList;

	constructor(
		options: RecodeWorkerSettingsOptions,
		onChange: (id: RecodeWorkerSettingId, value: string) => void,
		onCancel: () => void,
	) {
		super();
		const items: WorkerSettingItem[] = options.workers.flatMap((worker) => {
			const workerName = `${worker.displayName}${worker.aliases?.[0] ? ` (${worker.aliases[0]})` : ""}`;
			const model = worker.modelPreference
				? `${worker.modelPreference.provider}/${worker.modelPreference.id}`
				: "current (follows Aizen)";
			const shared = { workerId: worker.id, workerName, searchText: `${worker.id} ${workerName}` };
			const directChat = options.directChats?.get(worker.id);
			const turns = directChat
				? `${directChat.turnCount} ${directChat.turnCount === 1 ? "turn" : "turns"}`
				: undefined;
			return [
				{
					...shared,
					id: settingId(worker.id, "chat"),
					label: "Direct Chat",
					description: `Start or continue a private chat stored in this RePi session with ${workerName}`,
					currentValue: directChat ? `continue · ${turns}` : "start",
					values: [directChat ? `continue · ${turns}` : "start"],
				},
				{
					...shared,
					id: settingId(worker.id, "status"),
					label: "Status",
					description: "Show current conversation state and turn count",
					currentValue: directChat ? `${directChat.status} · ${turns}` : "ready",
					values: [directChat ? `${directChat.status} · ${turns}` : "ready"],
				},
				{
					...shared,
					id: settingId(worker.id, "model"),
					label: "Model",
					description: "Choose the current Aizen model or a fixed available model",
					currentValue: model,
					values: [...new Set(["current (follows Aizen)", model, ...options.modelValues])],
				},
				{
					...shared,
					id: settingId(worker.id, "thinking"),
					label: "Thinking",
					description: "Reasoning level requested for new worker turns",
					currentValue: worker.thinkingLevel,
					values: ["off", "minimal", "low", "medium", "high", "xhigh", "max"],
				},
				{
					...shared,
					id: settingId(worker.id, "tokens"),
					label: "Token Budget",
					description: "Maximum generated tokens requested for each new worker turn",
					currentValue: String(worker.maxOutputTokens),
					values: ["4096", "8192", "16384", "32768"],
				},
				{
					...shared,
					id: settingId(worker.id, "tools"),
					label: "Tools",
					description: "View the enforced read-only tool allowlist",
					currentValue: "view",
					values: ["view"],
				},
				{
					...shared,
					id: settingId(worker.id, "prompt"),
					label: "Prompt/Personality",
					description: "View the stable role, personality, and system instructions",
					currentValue: "view",
					values: ["view"],
				},
				{
					...shared,
					id: settingId(worker.id, "close"),
					label: "Close Direct Chat",
					description: "Forget this worker's current session-scoped direct conversation",
					currentValue: directChat ? "close" : "none",
					values: [directChat ? "close" : "none"],
				},
			];
		});

		this.addChild(new DynamicBorder());
		this.settingsList = new GroupedWorkerSettingsList(
			items,
			options.maxVisible,
			(rawId, value) => {
				const id = parseWorkerSettingId(rawId);
				if (id) onChange(id, value);
			},
			onCancel,
		);
		this.addChild(this.settingsList);
		this.addChild(new DynamicBorder());
	}

	updateValue(id: RecodeWorkerSettingId, value: string): void {
		this.settingsList.updateValue(settingId(id.workerId, id.action), value);
	}

	handleInput(data: string): void {
		this.settingsList.handleInput(data);
	}
}
