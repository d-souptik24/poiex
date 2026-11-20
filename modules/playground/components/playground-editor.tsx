"use client"

import { useRef, useEffect, useCallback, useMemo } from "react"
import { Loader2 } from "lucide-react"
import { useEditorSettings } from "@/modules/settings/hooks/use-editor-settings"
import Editor, { type Monaco } from "@monaco-editor/react"
import type { IDisposable, editor } from "monaco-editor"
import { registerCompletion, type CompletionRegistration } from "monacopilot"
import { TemplateFile } from "../lib/path-to-json"
import { configureMonaco, defaultEditorOptions, getEditorLanguage } from "../lib/editor-config"
import { disposeAllMonacoModels } from "../lib/monaco-cleanup"

interface PlaygroundEditorProps {
    activeFile: (TemplateFile & { id?: string }) | undefined
    content: string
    onContentChange: (value: string) => void
    isAIEnabled?: boolean
    editorTheme?: string
}

export const PlaygroundEditor = ({
    activeFile,
    content,
    onContentChange,
    isAIEnabled = true,
    editorTheme = "modern-dark",
}: PlaygroundEditorProps) => {
    const { settings: editorSettings } = useEditorSettings()
    const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null)
    const monacoRef = useRef<Monaco | null>(null)
    const completionRegistrationRef = useRef<CompletionRegistration | null>(null)
    const contentListenerRef = useRef<IDisposable | null>(null)
    const abortControllerRef = useRef<AbortController | null>(null)
    const debounceTimerRef = useRef<NodeJS.Timeout | null>(null)
    const isManualTriggerRef = useRef(false)

    const editorThemeRef = useRef(editorTheme)
    const focusListenerRef = useRef<IDisposable | null>(null)

    useEffect(() => {
        editorThemeRef.current = editorTheme
    }, [editorTheme])

    const cancelPendingCompletion = useCallback(() => {
        if (debounceTimerRef.current) {
            clearTimeout(debounceTimerRef.current)
            debounceTimerRef.current = null
        }
        if (abortControllerRef.current) {
            abortControllerRef.current.abort()
            abortControllerRef.current = null
        }
    }, [])

    const updateEditorLanguage = useCallback(() => {
        if (!activeFile || !monacoRef.current || !editorRef.current) return
        const model = editorRef.current.getModel()
        if (!model) return

        const language = getEditorLanguage(activeFile.fileExtension || "")
        try {
            monacoRef.current.editor.setModelLanguage(model, language)
        } catch (error) {
            console.warn("Failed to set editor language:", error)
        }
    }, [activeFile])

    const registerMonacopilot = useCallback(() => {
        if (!editorRef.current || !monacoRef.current) return
        const editor = editorRef.current
        const monaco = monacoRef.current

        // Cleanup existing completion registration
        if (completionRegistrationRef.current) {
            completionRegistrationRef.current.deregister()
            completionRegistrationRef.current = null
        }
        cancelPendingCompletion()

        if (isAIEnabled) {
            const language = activeFile ? getEditorLanguage(activeFile.fileExtension || "") : "plaintext"
            const filename = activeFile ? `${activeFile.filename}.${activeFile.fileExtension}` : undefined

            completionRegistrationRef.current = registerCompletion(monaco, editor, {
                language,
                filename,
                trigger: "onIdle",
                enableCaching: true,
                maxContextLines: 120,
                requestHandler: async ({ body }) => {
                    cancelPendingCompletion()

                    const isManual = isManualTriggerRef.current
                    isManualTriggerRef.current = false

                    // Client-side heuristics: Skip wasteful automatic requests when user is typing mundane punctuation or empty space
                    if (!isManual) {
                        const textBefore = body.completionMetadata?.textBeforeCursor ?? ""
                        const textAfter = body.completionMetadata?.textAfterCursor ?? ""
                        const trimmedBefore = textBefore.trimEnd()

                        // 1. Skip if line ends with a completed statement terminator (; or };)
                        if (trimmedBefore.endsWith(";") || trimmedBefore.endsWith("};")) {
                            return { completion: null }
                        }

                        // 2. Skip if cursor is inside an existing alphanumeric identifier (e.g. `isLo|ading`)
                        const charBefore = textBefore.slice(-1)
                        const charAfter = textAfter.slice(0, 1)
                        if (/[a-zA-Z0-9_]/.test(charBefore) && /[a-zA-Z0-9_]/.test(charAfter)) {
                            return { completion: null }
                        }

                        // 3. Skip if on an empty blank line surrounded by code (unless comment/block opener above)
                        const linesBefore = textBefore.split("\n")
                        const currentLineBefore = linesBefore[linesBefore.length - 1] ?? ""
                        const prevLine = linesBefore.length > 1 ? linesBefore[linesBefore.length - 2].trim() : ""
                        if (
                            !currentLineBefore.trim() &&
                            !prevLine.startsWith("//") &&
                            !prevLine.endsWith("{") &&
                            !prevLine.endsWith("(") &&
                            !prevLine.endsWith("=")
                        ) {
                            return { completion: null }
                        }
                    }

                    const delay = isManual ? 0 : 550 // 0ms instant for manual hotkey; 550ms pause buffer while typing

                    return new Promise((resolve) => {
                        const controller = new AbortController()
                        abortControllerRef.current = controller

                        debounceTimerRef.current = setTimeout(async () => {
                            debounceTimerRef.current = null
                            try {
                                const response = await fetch("/api/code-completion", {
                                    method: "POST",
                                    headers: { "Content-Type": "application/json" },
                                    body: JSON.stringify(body),
                                    signal: controller.signal,
                                })

                                if (!response.ok) {
                                    resolve({ completion: null })
                                    return
                                }

                                const data = await response.json()
                                resolve({ completion: data.completion ?? null })
                            } catch (error) {
                                if (error instanceof Error && error.name === "AbortError") {
                                    resolve({ completion: null })
                                    return
                                }
                                resolve({ completion: null })
                            } finally {
                                if (abortControllerRef.current === controller) {
                                    abortControllerRef.current = null
                                }
                            }
                        }, delay)
                    })
                },
            })
        }
    }, [activeFile, isAIEnabled, cancelPendingCompletion])

    const handleEditorDidMount = (editor: editor.IStandaloneCodeEditor, monaco: Monaco) => {
        editorRef.current = editor
        monacoRef.current = monaco

        configureMonaco(monaco)

        // Cancel in-flight completions immediately when user types
        if (contentListenerRef.current) {
            contentListenerRef.current.dispose()
        }
        contentListenerRef.current = editor.onDidChangeModelContent(() => {
            cancelPendingCompletion()
        })

        // Manual trigger handler (0ms debounce bypass)
        const triggerAI = () => {
            isManualTriggerRef.current = true
            if (completionRegistrationRef.current) {
                completionRegistrationRef.current.trigger()
            } else {
                editor.trigger("keyboard", "editor.action.inlineSuggest.trigger", {})
            }
        }

        // Register dedicated action for manual AI inline completion
        // Accessible via Alt+\ (VS Code / Copilot standard), Ctrl+Space, Ctrl+/, Command Palette (F1), and editor context menu
        editor.addAction({
            id: "poiex.trigger-ai-suggestion",
            label: "Trigger AI Inline Suggestion",
            keybindings: [
                monaco.KeyMod.Alt | monaco.KeyCode.Backslash,
                monaco.KeyMod.CtrlCmd | monaco.KeyCode.Space,
                monaco.KeyMod.CtrlCmd | monaco.KeyCode.Slash,
            ],
            contextMenuGroupId: "1_modification",
            contextMenuOrder: 1.5,
            run: () => {
                triggerAI()
            },
        })

        updateEditorLanguage()
        registerMonacopilot()
        if (editorTheme) {
            monaco.editor.setTheme(editorTheme)
        }

        // Ensure active theme is immediately re-asserted if editor regains focus
        if (focusListenerRef.current) {
            focusListenerRef.current.dispose()
        }
        focusListenerRef.current = editor.onDidFocusEditorText(() => {
            if (editorThemeRef.current && monacoRef.current) {
                try {
                    monacoRef.current.editor.setTheme(editorThemeRef.current)
                } catch {}
            }
        })
    }

    // Explicitly update theme on editor instance when prop changes
    useEffect(() => {
        if (monacoRef.current && editorTheme) {
            try {
                monacoRef.current.editor.setTheme(editorTheme)
            } catch (err) {
                console.warn("Failed to set Monaco theme:", err)
            }
        }
    }, [editorTheme])

    // Synchronize language and monacopilot when activeFile or isAIEnabled changes
    useEffect(() => {
        updateEditorLanguage()
        registerMonacopilot()
    }, [updateEditorLanguage, registerMonacopilot])

    const activeFilePath = useMemo(() => {
        if (!activeFile) return undefined
        if ("id" in activeFile && typeof activeFile.id === "string" && activeFile.id) {
            return activeFile.id
        }
        return `${activeFile.filename}${activeFile.fileExtension ? `.${activeFile.fileExtension}` : ""}`
    }, [activeFile])

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            cancelPendingCompletion()
            if (contentListenerRef.current) {
                contentListenerRef.current.dispose()
                contentListenerRef.current = null
            }
            if (focusListenerRef.current) {
                focusListenerRef.current.dispose()
                focusListenerRef.current = null
            }
            if (completionRegistrationRef.current) {
                completionRegistrationRef.current.deregister()
                completionRegistrationRef.current = null
            }
            disposeAllMonacoModels()
        }
    }, [cancelPendingCompletion])

    const mergedOptions = useMemo<editor.IStandaloneEditorConstructionOptions>(() => ({
        ...defaultEditorOptions,
        fontSize: editorSettings.fontSize,
        tabSize: editorSettings.tabSize,
        wordWrap: (editorSettings.wordWrap ? "on" : "off") as "on" | "off",
        minimap: {
            ...defaultEditorOptions.minimap,
            enabled: editorSettings.minimap,
        },
        inlineSuggest: {
            enabled: true,
            mode: "subwordSmart",
        },
        suggest: {
            preview: true,
            showInlineDetails: true,
        },
    }), [editorSettings])

    return (
        <div className="h-full relative">
            <Editor
                height="100%"
                path={activeFilePath}
                value={content}
                theme={editorTheme}
                onChange={(value) => onContentChange(value || "")}
                onMount={handleEditorDidMount}
                language={activeFile ? getEditorLanguage(activeFile.fileExtension || "") : "plaintext"}
                options={mergedOptions}
                loading={
                    <div className="flex h-full w-full items-center justify-center bg-background select-none">
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <Loader2 className="h-4 w-4 animate-spin text-[#e93f3f]" />
                            <span>Loading editor...</span>
                        </div>
                    </div>
                }
            />
        </div>
    )
}

export default PlaygroundEditor
