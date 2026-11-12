"use client";

import { useSyncExternalStore, useCallback } from "react";
import { DEFAULT_EDITOR_SETTINGS, type EditorSettings } from "../types";

const SETTINGS_KEY = "poiex-editor-settings";
const listeners = new Set<() => void>();

function emitChange() {
    listeners.forEach((listener) => listener());
}

function subscribe(callback: () => void) {
    listeners.add(callback);
    return () => {
        listeners.delete(callback);
    };
}

let cachedRaw: string | null = null;
let cachedSettings: EditorSettings = DEFAULT_EDITOR_SETTINGS;

function getSnapshot(): EditorSettings {
    try {
        if (typeof window === "undefined") {
            return DEFAULT_EDITOR_SETTINGS;
        }
        const raw = localStorage.getItem(SETTINGS_KEY);
        if (raw === cachedRaw) {
            return cachedSettings;
        }
        cachedRaw = raw;
        if (!raw) {
            cachedSettings = DEFAULT_EDITOR_SETTINGS;
            return cachedSettings;
        }
        const parsed = JSON.parse(raw);
        cachedSettings = {
            fontSize: typeof parsed.fontSize === "number" ? parsed.fontSize : DEFAULT_EDITOR_SETTINGS.fontSize,
            tabSize: typeof parsed.tabSize === "number" ? parsed.tabSize : DEFAULT_EDITOR_SETTINGS.tabSize,
            wordWrap: typeof parsed.wordWrap === "boolean" ? parsed.wordWrap : DEFAULT_EDITOR_SETTINGS.wordWrap,
            minimap: typeof parsed.minimap === "boolean" ? parsed.minimap : DEFAULT_EDITOR_SETTINGS.minimap,
        };
        return cachedSettings;
    } catch {
        return DEFAULT_EDITOR_SETTINGS;
    }
}

function getServerSnapshot(): EditorSettings {
    return DEFAULT_EDITOR_SETTINGS;
}

export function useEditorSettings() {
    const settings = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

    const updateSetting = useCallback(<K extends keyof EditorSettings>(key: K, value: EditorSettings[K]) => {
        try {
            const current = getSnapshot();
            const updated = { ...current, [key]: value };
            localStorage.setItem(SETTINGS_KEY, JSON.stringify(updated));
            cachedRaw = null;
            emitChange();
        } catch (error) {
            console.error("Failed to update editor setting:", error);
        }
    }, []);

    const resetDefaults = useCallback(() => {
        try {
            localStorage.setItem(SETTINGS_KEY, JSON.stringify(DEFAULT_EDITOR_SETTINGS));
            cachedRaw = null;
            emitChange();
        } catch (error) {
            console.error("Failed to reset editor settings:", error);
        }
    }, []);

    return {
        settings,
        updateSetting,
        resetDefaults,
    };
}
