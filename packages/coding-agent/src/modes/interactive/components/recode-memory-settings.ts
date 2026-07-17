import { Container, type SettingItem, SettingsList } from "@reitaard/repi-tui";
import { getSettingsListTheme } from "../theme/theme.ts";
import { DynamicBorder } from "./dynamic-border.ts";

export type RecodeMemorySettingId =
	| "enabled"
	| "project-auto-recall"
	| "global-access"
	| "global-auto-recall"
	| "shiori-model"
	| "shiori-thinking"
	| "cardinal-routing"
	| "search-scope"
	| "reindex"
	| "status";

export interface RecodeMemorySettingsState {
	enabled: boolean;
	projectAutoRecall: boolean;
	globalAccess: boolean;
	globalAutoRecall: boolean;
	shioriModel: string;
	shioriModels: string[];
	shioriThinking: boolean;
	cardinalRouting: "ask" | "auto" | "global" | "project";
	searchScope: "both" | "global" | "project";
}

export class RecodeMemorySettingsComponent extends Container {
	private readonly settingsList: SettingsList;

	constructor(
		state: RecodeMemorySettingsState,
		onChange: (id: RecodeMemorySettingId, value: string) => void,
		onCancel: () => void,
	) {
		super();
		const items: SettingItem[] = [
			{
				id: "enabled",
				label: "Kioku (記憶)",
				description: "Enable durable project and global memory",
				currentValue: state.enabled ? "enabled" : "disabled",
				values: ["enabled", "disabled"],
			},
			{
				id: "project-auto-recall",
				label: "Project auto-recall",
				description: "Inject relevant project memory before agent turns",
				currentValue: state.projectAutoRecall ? "enabled" : "disabled",
				values: ["enabled", "disabled"],
			},
			{
				id: "global-access",
				label: "Global memory access",
				description: "Allow explicit global memory search, read, and write",
				currentValue: state.globalAccess ? "enabled" : "disabled",
				values: ["enabled", "disabled"],
			},
			{
				id: "global-auto-recall",
				label: "Global auto-recall",
				description: "Inject relevant global memory before agent turns",
				currentValue: state.globalAutoRecall ? "enabled" : "disabled",
				values: ["enabled", "disabled"],
			},
			{
				id: "shiori-model",
				label: "Shiori model",
				description: "Model used by Shiori to review session memory",
				currentValue: state.shioriModel,
				values: state.shioriModels,
			},
			{
				id: "shiori-thinking",
				label: "Shiori thinking",
				description: "Allow Shiori to reason before extracting memory",
				currentValue: state.shioriThinking ? "on" : "off",
				values: ["off", "on"],
			},
			{
				id: "cardinal-routing",
				label: "Cardinal routing",
				description: "Choose where Shiori's durable memories are saved",
				currentValue: state.cardinalRouting,
				values: ["auto", "project", "global", "ask"],
			},
			{
				id: "search-scope",
				label: "Default search scope",
				description: "Memory roots searched by explicit recall",
				currentValue: state.searchScope,
				values: ["project", "global", "both"],
			},
			{
				id: "reindex",
				label: "Reindex memory",
				description: "Reconcile Markdown memory with the SQLite search index",
				currentValue: "run",
				values: ["run"],
			},
			{
				id: "status",
				label: "Show status",
				description: "Show memory roots, configuration, and index counts",
				currentValue: "open",
				values: ["open"],
			},
		];

		this.addChild(new DynamicBorder());
		this.settingsList = new SettingsList(
			items,
			8,
			getSettingsListTheme(),
			(id, value) => onChange(id as RecodeMemorySettingId, value),
			onCancel,
			{ enableSearch: true },
		);
		this.addChild(this.settingsList);
		this.addChild(new DynamicBorder());
	}

	updateValue(id: RecodeMemorySettingId, value: string): void {
		this.settingsList.updateValue(id, value);
	}

	handleInput(data: string): void {
		this.settingsList.handleInput(data);
	}
}
