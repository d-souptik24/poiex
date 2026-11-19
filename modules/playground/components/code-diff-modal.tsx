"use client";

import React, { useMemo, useRef, useEffect } from "react";
import { DiffEditor } from "@monaco-editor/react";
import type { editor } from "monaco-editor";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogTitle,
} from "@/components/ui/dialog";
import { ActionTooltip } from "@/components/ui/action-tooltip";
import { getEditorLanguage } from "@/modules/playground/lib/editor-config";

interface CodeDiffModalProps {
    isOpen: boolean;
    onClose: () => void;
    filename: string;
    originalCode: string;
    modifiedCode: string;
    onAccept: () => void;
    onReject: () => void;
    theme?: string;
}

export const CodeDiffModal: React.FC<CodeDiffModalProps> = ({
    isOpen,
    onClose,
    filename,
    originalCode,
    modifiedCode,
    onAccept,
    onReject,
    theme = "modern-dark",
}) => {
    const diffEditorRef = useRef<editor.IStandaloneDiffEditor | null>(null);
    const [monacoDiffStats, setMonacoDiffStats] = React.useState<{
        added: number;
        removed: number;
        rangeText: string;
    } | null>(null);
    const ext = filename.split(".").pop() || "ts";
    const language = getEditorLanguage(ext);

    // Safely detach diff models before unmounting to prevent Monaco assertion error:
    // "TextModel got disposed before DiffEditorWidget model got reset"
    useEffect(() => {
        return () => {
            if (diffEditorRef.current) {
                try {
                    diffEditorRef.current.setModel({
                        original: null as unknown as editor.ITextModel,
                        modified: null as unknown as editor.ITextModel,
                    });
                } catch {}
                diffEditorRef.current = null;
            }
        };
    }, []);

    // Compute prefix/suffix baseline diff line counts and changed line ranges
    const baselineStats = useMemo(() => {
        const orig = originalCode ? originalCode.split("\n") : [];
        const mod = modifiedCode ? modifiedCode.split("\n") : [];

        if (orig.length === 0 && mod.length === 0) {
            return { addedLines: 0, removedLines: 0, lineRangeText: "No changes" };
        }
        if (orig.length === 0) {
            return { addedLines: mod.length, removedLines: 0, lineRangeText: `All ${mod.length} lines` };
        }
        if (mod.length === 0) {
            return { addedLines: 0, removedLines: orig.length, lineRangeText: `All ${orig.length} lines removed` };
        }

        // 1. Common prefix lines
        let prefix = 0;
        while (prefix < orig.length && prefix < mod.length && orig[prefix] === mod[prefix]) {
            prefix++;
        }

        // 2. Common suffix lines
        let origSuffix = orig.length - 1;
        let modSuffix = mod.length - 1;
        while (origSuffix >= prefix && modSuffix >= prefix && orig[origSuffix] === mod[modSuffix]) {
            origSuffix--;
            modSuffix--;
        }

        const removed = Math.max(0, origSuffix - prefix + 1);
        const added = Math.max(0, modSuffix - prefix + 1);

        let rangeText = "";
        if (removed === 0 && added === 0) {
            rangeText = "No differences";
        } else {
            const startLine = prefix + 1;
            const endLine = Math.max(startLine, modSuffix + 1);
            rangeText = startLine === endLine ? `Line ${startLine}` : `Line ${startLine} to ${endLine}`;
        }

        return {
            addedLines: added,
            removedLines: removed,
            lineRangeText: rangeText,
        };
    }, [originalCode, modifiedCode]);

    const addedLines = monacoDiffStats ? monacoDiffStats.added : baselineStats.addedLines;
    const removedLines = monacoDiffStats ? monacoDiffStats.removed : baselineStats.removedLines;
    const lineRangeText = monacoDiffStats ? monacoDiffStats.rangeText : baselineStats.lineRangeText;

    // If modal is not open, unmount entirely to prevent unnecessary Monaco diff editor rendering
    if (!isOpen) return null;

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DialogContent
                showCloseButton={false}
                className="w-[95vw] sm:w-[95vw] max-w-7xl sm:max-w-7xl h-[88vh] flex flex-col p-0 gap-0 overflow-hidden bg-white dark:bg-[#111215] border border-zinc-200 dark:border-zinc-700/80 rounded-xl shadow-2xl ring-1 ring-black/5 dark:ring-white/5 text-zinc-900 dark:text-neutral-100"
            >
                {/* Adaptive scoped CSS overrides for diff line highlights in both light and dark themes */}
                <style>{`
                    /* Light Mode Diff Highlights */
                    .poiex-diff-container .monaco-diff-editor .line-insert {
                        background-color: rgba(16, 185, 129, 0.12) !important;
                    }
                    .poiex-diff-container .monaco-diff-editor .char-insert {
                        background-color: rgba(16, 185, 129, 0.28) !important;
                    }
                    .poiex-diff-container .monaco-diff-editor .line-delete {
                        background-color: rgba(239, 68, 68, 0.10) !important;
                    }
                    .poiex-diff-container .monaco-diff-editor .char-delete {
                        background-color: rgba(239, 68, 68, 0.24) !important;
                    }
                    .poiex-diff-container .monaco-diff-editor .diagonal-fill {
                        background-color: transparent !important;
                        background-image: repeating-linear-gradient(
                            -45deg,
                            rgba(0, 0, 0, 0.04),
                            rgba(0, 0, 0, 0.04) 7px,
                            transparent 7px,
                            transparent 14px
                        ) !important;
                    }

                    /* Dark Mode Diff Highlights */
                    .dark .poiex-diff-container .monaco-diff-editor .line-insert {
                        background-color: #10b9811f !important;
                    }
                    .dark .poiex-diff-container .monaco-diff-editor .char-insert {
                        background-color: #10b9813d !important;
                    }
                    .dark .poiex-diff-container .monaco-diff-editor .line-delete {
                        background-color: #ef44441f !important;
                    }
                    .dark .poiex-diff-container .monaco-diff-editor .char-delete {
                        background-color: #ef44443d !important;
                    }
                    .dark .poiex-diff-container .monaco-diff-editor .diagonal-fill {
                        background-color: transparent !important;
                        background-image: repeating-linear-gradient(
                            -45deg,
                            rgba(255, 255, 255, 0.03),
                            rgba(255, 255, 255, 0.03) 7px,
                            transparent 7px,
                            transparent 14px
                        ) !important;
                    }

                    .poiex-diff-container .monaco-diff-editor .insert-sign {
                        color: #10b981 !important;
                    }
                    .poiex-diff-container .monaco-diff-editor .delete-sign {
                        color: #ef4444 !important;
                    }
                `}</style>

                {/* Accessible Title / Description for Screen Readers */}
                <DialogTitle className="sr-only">Diff: {filename}</DialogTitle>
                <DialogDescription className="sr-only">
                    Side-by-side comparison between current and incoming code for {filename}
                </DialogDescription>

                {/* 1. Header: file path + diff count on left, Esc button on right */}
                <div className="h-10 px-4 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between shrink-0 bg-zinc-50/90 dark:bg-[#111215] select-none font-sans">
                    <div className="flex items-center gap-2 font-mono text-xs select-none">
                        <span className="text-zinc-800 dark:text-neutral-200 font-medium">{filename}</span>
                        <span className="text-emerald-600 dark:text-emerald-500 font-semibold">+{addedLines}</span>
                        <span className="text-red-600 dark:text-red-500 font-semibold">-{removedLines}</span>
                    </div>

                    <ActionTooltip label="Close (Esc)">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-2 py-0.5 text-xs font-mono text-zinc-600 dark:text-neutral-300 hover:text-zinc-900 dark:hover:text-white bg-zinc-200/60 dark:bg-neutral-800/80 hover:bg-zinc-200 dark:hover:bg-neutral-800 border border-zinc-300 dark:border-neutral-700/80 rounded transition-colors cursor-pointer"
                        >
                            Esc
                        </button>
                    </ActionTooltip>
                </div>

                {/* 2. Subdued Column Labels (Current vs Incoming) with centered 1px split divider */}
                <div className="h-8 border-b border-zinc-200 dark:border-zinc-800 grid grid-cols-2 bg-zinc-100/70 dark:bg-[#111215] text-xs font-mono text-zinc-500 dark:text-neutral-400 select-none">
                    <div className="flex items-center justify-center border-r border-zinc-200 dark:border-zinc-800">
                        Current
                    </div>
                    <div className="flex items-center justify-center">
                        Suggested
                    </div>
                </div>

                {/* 3. Monaco Diff Editor Canvas with 1px Center Split Line — inherits user's active theme */}
                <div className="poiex-diff-container relative flex-1 min-h-0 w-full overflow-hidden bg-white dark:bg-[#111215]">
                    <DiffEditor
                        height="100%"
                        language={language}
                        original={originalCode}
                        modified={modifiedCode}
                        theme={theme}
                        onMount={(diffEditor, monaco) => {
                            diffEditorRef.current = diffEditor;

                            // Bind Escape key inside Monaco editor to trigger onClose
                            diffEditor.addCommand(monaco.KeyCode.Escape, () => {
                                onClose();
                            });

                            // Synchronize precise line changes from Monaco's Myers diff worker
                            const updateFromMonaco = () => {
                                const changes = diffEditor.getLineChanges();
                                if (!changes || changes.length === 0) return;

                                let added = 0;
                                let removed = 0;
                                let firstDiff = -1;
                                let lastDiff = -1;

                                for (const change of changes) {
                                    const origCount =
                                        change.originalEndLineNumber >= change.originalStartLineNumber &&
                                        change.originalStartLineNumber > 0
                                            ? change.originalEndLineNumber - change.originalStartLineNumber + 1
                                            : 0;
                                    const modCount =
                                        change.modifiedEndLineNumber >= change.modifiedStartLineNumber &&
                                        change.modifiedStartLineNumber > 0
                                            ? change.modifiedEndLineNumber - change.modifiedStartLineNumber + 1
                                            : 0;

                                    removed += origCount;
                                    added += modCount;

                                    const start =
                                        change.modifiedStartLineNumber > 0
                                            ? change.modifiedStartLineNumber
                                            : change.originalStartLineNumber;
                                    const end =
                                        change.modifiedEndLineNumber > 0
                                            ? change.modifiedEndLineNumber
                                            : change.originalEndLineNumber;

                                    if (firstDiff === -1 || (start > 0 && start < firstDiff)) firstDiff = start;
                                    if (end > lastDiff) lastDiff = end;
                                }

                                const rangeText =
                                    firstDiff !== -1 && lastDiff !== -1
                                        ? firstDiff === lastDiff
                                            ? `Line ${firstDiff}`
                                            : `Line ${firstDiff} to ${lastDiff}`
                                        : "";

                                setMonacoDiffStats({
                                    added,
                                    removed,
                                    rangeText,
                                });
                            };

                            diffEditor.onDidUpdateDiff(updateFromMonaco);
                            updateFromMonaco();
                        }}
                        options={{
                            readOnly: true,
                            renderSideBySide: true,
                            originalEditable: false,
                            minimap: { enabled: false },
                            scrollBeyondLastLine: false,
                            fontSize: 13,
                            lineNumbers: "on",
                            wordWrap: "on",
                            diffWordWrap: "on",
                            automaticLayout: true,
                            renderIndicators: true,
                            useInlineViewWhenSpaceIsLimited: false,
                            renderOverviewRuler: false,
                        }}
                    />
                    {/* Visual 1px vertical divider between Current and Incoming editor panes */}
                    <div className="absolute top-0 bottom-0 left-1/2 w-px bg-zinc-200 dark:bg-zinc-800 pointer-events-none z-10" />
                </div>

                {/* 4. Native Desktop Footer: Line Range on Left, Dismiss and Accept on Right */}
                <div className="h-12 px-4 bg-zinc-50/90 dark:bg-[#111215] border-t border-zinc-200 dark:border-zinc-800 flex items-center justify-between shrink-0 font-mono">
                    <span className="text-zinc-500 dark:text-neutral-400 text-xs font-mono select-none">
                        {lineRangeText}
                    </span>

                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            onClick={() => {
                                onReject();
                                onClose();
                            }}
                            className="px-3.5 py-1.5 rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900/80 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-700 dark:text-neutral-300 text-xs font-mono transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-zinc-400"
                        >
                            Dismiss
                        </button>
                        <button
                            type="button"
                            onClick={() => {
                                onAccept();
                                onClose();
                            }}
                            className="px-4 py-1.5 rounded-md bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-mono font-medium transition-colors shadow-xs cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
                        >
                            Accept
                        </button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
};
