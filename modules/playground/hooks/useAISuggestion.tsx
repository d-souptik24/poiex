import { useState, useCallback, useSyncExternalStore } from "react";

export interface UseAISuggestionsReturn {
    isEnabled: boolean;
    isLoading: boolean;
    toggleEnabled: () => void;
}

const STORAGE_KEY = "poiex-ai-enabled";
const listeners = new Set<() => void>();

const getAISnapshot = (): boolean => {
    try {
        if (typeof window === "undefined") return true;
        const val = localStorage.getItem(STORAGE_KEY);
        if (val !== null) return val === "true";
    } catch {
        // Fallback for private browsing or restricted environments
    }
    return true; // default enabled
};

const getServerSnapshot = (): boolean => true;

const subscribe = (listener: () => void) => {
    listeners.add(listener);
    if (typeof window !== "undefined") {
        window.addEventListener("storage", listener);
    }
    return () => {
        listeners.delete(listener);
        if (typeof window !== "undefined") {
            window.removeEventListener("storage", listener);
        }
    };
};

export const useAISuggestions = (): UseAISuggestionsReturn => {
    const isEnabled = useSyncExternalStore(subscribe, getAISnapshot, getServerSnapshot);
    const [isLoading] = useState(false);

    const toggleEnabled = useCallback(() => {
        try {
            const current = getAISnapshot();
            const next = !current;
            localStorage.setItem(STORAGE_KEY, String(next));
            listeners.forEach((listener) => listener());
        } catch (e) {
            console.error("Failed to persist AI suggestion state:", e);
        }
    }, []);

    return {
        isEnabled,
        isLoading,
        toggleEnabled,
    };
};
