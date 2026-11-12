export interface EditorSettings {
    fontSize: number;
    tabSize: number;
    wordWrap: boolean;
    minimap: boolean;
}

export const DEFAULT_EDITOR_SETTINGS: EditorSettings = {
    fontSize: 14,
    tabSize: 2,
    wordWrap: false,
    minimap: false,
};

export const FONT_SIZE_OPTIONS = [
    { label: "12px", value: 12 },
    { label: "14px (Default)", value: 14 },
    { label: "16px", value: 16 },
    { label: "18px", value: 18 },
] as const;

export const TAB_SIZE_OPTIONS = [
    { label: "2 spaces (Default)", value: 2 },
    { label: "4 spaces", value: 4 },
] as const;
