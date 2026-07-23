import type { RecodeMemoryConfig, RecodeShioriModelPreference, RecodeShioriRouting } from "./recode-memory-types.ts";

export const RECODE_SHIORI_SETTINGS_REQUEST = "recode:shiori-settings:request";
export const RECODE_SHIORI_SETTINGS_UPDATE = "recode:shiori-settings:update";

export interface RecodeShioriSettingsSnapshot {
	enabled: boolean;
	reviewing: boolean;
	model?: RecodeShioriModelPreference;
	thinking: boolean;
	cardinalRouting: RecodeShioriRouting;
}

export interface RecodeShioriSettingsRequest {
	resolve(snapshot: RecodeShioriSettingsSnapshot): void;
}

export interface RecodeShioriSettingsUpdate {
	patch: Pick<Partial<RecodeMemoryConfig>, "shioriModel" | "shioriThinking" | "cardinalRouting">;
	resolve(snapshot: RecodeShioriSettingsSnapshot): void;
	reject(error: unknown): void;
}
