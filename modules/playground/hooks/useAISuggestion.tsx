import { useState, useCallback, useRef } from "react";
import type { editor as monacoEditor } from "monaco-editor";
import type { Monaco } from "@monaco-editor/react";

type EditorInstance = monacoEditor.IStandaloneCodeEditor;

interface AISuggestionsState {
    suggestion: string | null;
    isLoading: boolean;
    position: { line: number; column: number } | null;
    isEnabled: boolean;
}

interface UseAISuggestionsReturn extends AISuggestionsState {
    toggleEnabled: () => void;
    fetchSuggestion: (type: string, editor: EditorInstance | null, fileName?: string) => Promise<void>;
    acceptSuggestion: (editor?: EditorInstance | null, monaco?: Monaco | null) => void;
    rejectSuggestion: (editor?: EditorInstance | null) => void;
    clearSuggestion: (editor?: EditorInstance | null) => void;
}

export const useAISuggestions = (): UseAISuggestionsReturn => {
    const [state, setState] = useState<AISuggestionsState>({
        suggestion: null,
        isLoading: false,
        position: null,
        isEnabled: true,
    });

    const abortControllerRef = useRef<AbortController | null>(null);

    const toggleEnabled = useCallback(() => {
        setState((prev) => ({ ...prev, isEnabled: !prev.isEnabled }));
    }, []);

    const fetchSuggestion = useCallback(async (type: string, editor: EditorInstance | null, fileName?: string) => {
        if (!editor) return;

        const model = editor.getModel();
        const cursorPosition = editor.getPosition();
        if (!model || !cursorPosition) return;

        // Only skip if the file is completely blank (no context available)
        if (!model.getValue().trim()) return;

        // Abort previous in-flight request to prevent queuing on CPU
        if (abortControllerRef.current) {
            abortControllerRef.current.abort();
        }

        const controller = new AbortController();
        abortControllerRef.current = controller;

        setState((prev) => {
            if (!prev.isEnabled) return prev;
            return { ...prev, isLoading: true };
        });

        try {
            const payload = {
                fileContent: model.getValue(),
                cursorLine: cursorPosition.lineNumber - 1,
                cursorColumn: cursorPosition.column - 1,
                suggestionType: type,
                fileName,
            };

            const response = await fetch("/api/code-completion", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
                signal: controller.signal,
            });

            if (!response.ok) {
                throw new Error(`API responded with status ${response.status}`);
            }

            const data = await response.json();

            if (data.suggestion) {
                const suggestionText = data.suggestion.trim();
                setState((prev) => ({
                    ...prev,
                    suggestion: suggestionText,
                    position: {
                        line: cursorPosition.lineNumber,
                        column: cursorPosition.column,
                    },
                    isLoading: false,
                }));
            } else {
                setState((prev) => ({ ...prev, isLoading: false }));
            }
        } catch (error: unknown) {
            // Silently ignore aborted requests caused by user typing new characters
            if (error instanceof Error && error.name === "AbortError") {
                return;
            }
            console.error("Error fetching code suggestion:", error);
            setState((prev) => ({ ...prev, isLoading: false }));
        } finally {
            if (abortControllerRef.current === controller) {
                abortControllerRef.current = null;
            }
        }
    }, []);



    const acceptSuggestion = useCallback(() => {
        setState((currentState) => {
            if (!currentState.suggestion) {
                return currentState;
            }

            return {
                ...currentState,
                suggestion: null,
                position: null,
            };
        });
    }, []);

    const rejectSuggestion = useCallback(() => {
        setState((currentState) => ({
            ...currentState,
            suggestion: null,
            position: null,
        }));
    }, []);

    const clearSuggestion = useCallback(() => {
        setState((currentState) => ({
            ...currentState,
            suggestion: null,
            position: null,
        }));
    }, []);



    return {
        ...state,
        toggleEnabled,
        fetchSuggestion,
        acceptSuggestion,
        rejectSuggestion,
        clearSuggestion
    }

}
