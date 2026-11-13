"use client";

import Image from "next/image";
import Link from "next/link";
import { useCurrentUser } from "@/modules/auth/hooks/use-current-user";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

import { Button } from "@/components/ui/button";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuGroup,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuSub,
    DropdownMenuSubContent,
    DropdownMenuSubTrigger,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
    ResizableHandle,
    ResizablePanel,
    ResizablePanelGroup,
} from "@/components/ui/resizable";
import { usePanelRef } from "react-resizable-panels";
import { cn } from "@/lib/utils";
import { SidebarInset, SidebarTrigger, useSidebar } from "@/components/ui/sidebar";
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip";
import LoadingStep from "@/modules/playground/components/loader";
import { PlaygroundEditor } from "@/modules/playground/components/playground-editor";
import { TemplateFileTree } from "@/modules/playground/components/playground-explorer";
import ToggleAI from "@/modules/playground/components/toggle-ai";
import { useAISuggestions } from "@/modules/playground/hooks/useAISuggestion";
import { useFileExplorer } from "@/modules/playground/hooks/useFileExplorer";
import { usePlayground } from "@/modules/playground/hooks/usePlayground";
import { findFilePath, findFileByPath, findFirstFile, updateTemplateTreeWithFiles } from "@/modules/playground/lib";
import {
    TemplateFile,
    TemplateFolder,
} from "@/modules/playground/lib/path-to-json";
import { EDITOR_THEMES } from "@/modules/playground/lib/editor-config";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { useTheme } from "next-themes";
import WebContainerPreview from "@/modules/webcontainers/components/webcontainer-preview";
import { useWebContainer } from "@/modules/webcontainers/hooks/useWebContainer";
import { AIChatSidePanel } from "@/modules/ai-chat/components/ai-chat-sidebarpanel";
import { CodeDiffModal } from "@/modules/playground/components/code-diff-modal";
import { exportProjectAsZip } from "@/modules/playground/lib/export-zip";
import {
    AlertCircle,
    ArrowLeft,
    ArrowLeftRight,
    Download,
    ChevronRight,
    Check,
    Eye,
    EyeOff,
    FileText,
    FileX,
    FolderOpen,


    Palette,
    RotateCcw,
    Save,
    Settings,
    X,
} from "lucide-react";
import { useParams } from "next/navigation";
import React, {
    useCallback,
    useEffect,
    useRef,
    useState,
    useSyncExternalStore,
} from "react";
import { toast } from "sonner";

const themeListeners = new Set<() => void>();

const subscribeTheme = (callback: () => void) => {
    themeListeners.add(callback);
    return () => {
        themeListeners.delete(callback);
    };
};

const getThemeSnapshot = () => {
    try {
        return localStorage.getItem("poiex-editor-theme") || "modern-dark";
    } catch {
        return "modern-dark";
    }
};

const getServerThemeSnapshot = () => "modern-dark";

const setEditorThemePreference = (newTheme: string) => {
    try {
        localStorage.setItem("poiex-editor-theme", newTheme);
    } catch {
        // Ignore access errors in private browsing/sandboxes
    }
    themeListeners.forEach((listener) => listener());
};

const MainPlaygroundPage = () => {
    const { id } = useParams<{ id: string }>();
    const user = useCurrentUser();
    const { open } = useSidebar();
    const { resolvedTheme } = useTheme();
    const [isPreviewVisible, setIsPreviewVisible] = useState(() => {
        try {
            const saved = localStorage.getItem(`poiex-preview-visible-${id}`);
            return saved !== null ? saved === "true" : true;
        } catch {
            return true;
        }
    });
    const previewPanelRef = usePanelRef();

    const togglePreview = useCallback(() => {
        const panel = previewPanelRef.current;
        if (panel) {
            if (panel.isCollapsed()) {
                panel.expand();
                setIsPreviewVisible(true);
                try {
                    localStorage.setItem(`poiex-preview-visible-${id}`, "true");
                } catch {}
            } else {
                panel.collapse();
                setIsPreviewVisible(false);
                try {
                    localStorage.setItem(`poiex-preview-visible-${id}`, "false");
                } catch {}
            }
        } else {
            setIsPreviewVisible((prev) => {
                const next = !prev;
                try {
                    localStorage.setItem(`poiex-preview-visible-${id}`, String(next));
                } catch {}
                return next;
            });
        }
    }, [previewPanelRef, id]);

    const [isChatOpen, setIsChatOpen] = useState(() => {
        try {
            return localStorage.getItem(`poiex-chat-open-${id}`) === "true";
        } catch {
            return false;
        }
    });

    const handleSetIsChatOpen = useCallback((open: boolean) => {
        setIsChatOpen(open);
        try {
            localStorage.setItem(`poiex-chat-open-${id}`, String(open));
        } catch {}
    }, [id]);

    // Pillar 3: Pending review state for "Apply to Editor"
    const [pendingReview, setPendingReview] = useState<{
        fileId: string;
        filename: string;
        originalContent: string;
    } | null>(null);

    const { playgroundData, templateData, isLoading, error, saveTemplateData } =
        usePlayground(id);

    const aiSuggestions = useAISuggestions();

    const {
        setTemplateData,
        setActiveFileId,
        setPlaygroundId,
        setOpenFiles,
        activeFileId,
        closeAllFiles,
        closeFile,
        openFile,
        openFiles,

        handleAddFile,
        handleAddFolder,
        handleDeleteFile,
        handleDeleteFolder,
        handleRenameFile,
        handleRenameFolder,
        updateFileContent,
    } = useFileExplorer();

    const {
        serverUrl,
        isLoading: containerLoading,
        error: containerError,
        instance,
        writeFileSync,
    } = useWebContainer();

    const [lastSavedAt, setLastSavedAt] = useState<number>(0);
    const storedEditorTheme = useSyncExternalStore(
        subscribeTheme,
        getThemeSnapshot,
        getServerThemeSnapshot
    );

    // Synchronize editor theme with global resolved theme:
    // If the user's setting is "auto" (default), or if the stored theme was dark while in light mode (or vice versa),
    // automatically select the matching modern theme.
    const activeEditorTheme = React.useMemo(() => {
        const isLight = resolvedTheme === "light";
        if (storedEditorTheme === "auto" || !storedEditorTheme) {
            return isLight ? "modern-light" : "modern-dark";
        }
        return storedEditorTheme;
    }, [storedEditorTheme, resolvedTheme]);
    const lastSyncedContent = useRef<Map<string, string>>(new Map());
    const hasRestoredFilesRef = useRef(false);

    useEffect(() => {
        setPlaygroundId(id);
        hasRestoredFilesRef.current = false;
    }, [id, setPlaygroundId]);

    // Persist open files and active file whenever they change
    useEffect(() => {
        if (!id || !hasRestoredFilesRef.current) return;
        try {
            if (openFiles.length > 0) {
                const ids = openFiles.map((f) => f.id);
                localStorage.setItem(`poiex-open-files-${id}`, JSON.stringify(ids));
                if (activeFileId) {
                    localStorage.setItem(`poiex-active-file-${id}`, activeFileId);
                }
            } else {
                localStorage.setItem(`poiex-open-files-${id}`, JSON.stringify([]));
                localStorage.removeItem(`poiex-active-file-${id}`);
            }
        } catch {}
    }, [id, openFiles, activeFileId]);

    // Restore open files from localStorage once templateData is loaded
    useEffect(() => {
        if (!templateData || hasRestoredFilesRef.current) return;
        setTemplateData(templateData);

        try {
            const rawSavedIds = localStorage.getItem(`poiex-open-files-${id}`);
            const savedActiveId = localStorage.getItem(`poiex-active-file-${id}`);

            if (rawSavedIds) {
                const savedIds = JSON.parse(rawSavedIds) as string[];
                if (Array.isArray(savedIds) && savedIds.length > 0) {
                    for (const filePath of savedIds) {
                        const fileNode = findFileByPath(filePath, templateData);
                        if (fileNode) {
                            openFile(fileNode);
                        }
                    }
                    if (savedActiveId) {
                        const activeNode = findFileByPath(savedActiveId, templateData);
                        if (activeNode) {
                            openFile(activeNode);
                        }
                    }
                    hasRestoredFilesRef.current = true;
                    return;
                }
            }
        } catch (e) {
            console.error("Error restoring open files from storage:", e);
        }

        // If no saved files or first time visiting, open entry file
        if (!openFiles.length) {
            const entryFile =
                findFileByPath("src/index.ts", templateData) ||
                findFileByPath("index.ts", templateData) ||
                findFileByPath("src/App.tsx", templateData) ||
                findFileByPath("package.json", templateData) ||
                findFirstFile(templateData);

            if (entryFile) {
                openFile(entryFile);
            }
        }
        hasRestoredFilesRef.current = true;
    }, [templateData, id, openFile, openFiles.length, setTemplateData]);

    // Create wrapper functions that pass saveTemplateData
    const wrappedHandleAddFile = useCallback(
        (newFile: TemplateFile, parentPath: string) => {
            return handleAddFile(
                newFile,
                parentPath,
                writeFileSync!,
                instance,
                saveTemplateData
            );
        },
        [handleAddFile, writeFileSync, instance, saveTemplateData]
    );

    const wrappedHandleAddFolder = useCallback(
        (newFolder: TemplateFolder, parentPath: string) => {
            return handleAddFolder(newFolder, parentPath, instance, saveTemplateData);
        },
        [handleAddFolder, instance, saveTemplateData]
    );

    const wrappedHandleDeleteFile = useCallback(
        (file: TemplateFile, parentPath: string) => {
            return handleDeleteFile(file, parentPath, saveTemplateData);
        },
        [handleDeleteFile, saveTemplateData]
    );

    const wrappedHandleDeleteFolder = useCallback(
        (folder: TemplateFolder, parentPath: string) => {
            return handleDeleteFolder(folder, parentPath, saveTemplateData);
        },
        [handleDeleteFolder, saveTemplateData]
    );

    const wrappedHandleRenameFile = useCallback(
        (
            file: TemplateFile,
            newFilename: string,
            newExtension: string,
            parentPath: string
        ) => {
            return handleRenameFile(
                file,
                newFilename,
                newExtension,
                parentPath,
                saveTemplateData
            );
        },
        [handleRenameFile, saveTemplateData]
    );

    const wrappedHandleRenameFolder = useCallback(
        (
            folder: TemplateFolder,
            newFolderName: string,
            parentPath: string
        ) => {
            return handleRenameFolder(
                folder,
                newFolderName,
                parentPath,
                saveTemplateData
            );
        },
        [handleRenameFolder, saveTemplateData]
    );

    const [diffModalState, setDiffModalState] = useState<{
        isOpen: boolean;
        filename: string;
        originalCode: string;
        modifiedCode: string;
    }>({
        isOpen: false,
        filename: "",
        originalCode: "",
        modifiedCode: "",
    });

    const [isExportingZip, setIsExportingZip] = useState(false);
    const [terminalDiagnosticPrompt, setTerminalDiagnosticPrompt] = useState<string>("");

    const activeFile = openFiles.find((file) => file.id === activeFileId);

    // Pillar 3: Agentic Apply to Editor
    const handleApplyCode = useCallback(
        (code: string) => {
            if (!activeFileId || !activeFile) {
                toast.error("Please open an active file to apply code.");
                return;
            }

            // Snapshot current content for instant 1-click revert
            setPendingReview({
                fileId: activeFile.id,
                filename: `${activeFile.filename}.${activeFile.fileExtension}`,
                originalContent: activeFile.content,
            });

            // Apply new code into editor and WebContainer
            updateFileContent(activeFile.id, code);
            if (writeFileSync && instance && templateData) {
                const path = findFilePath(activeFile, templateData);
                if (path) {
                    writeFileSync(path.replace(/^\/+/, ""), code);
                }
            }
            toast.info(
                `Applied suggested changes to ${activeFile.filename}.${activeFile.fileExtension}. Review in editor.`,
                {
                    action: {
                        label: "View in Editor",
                        onClick: () => handleSetIsChatOpen(false),
                    },
                }
            );
        },
        [activeFileId, activeFile, updateFileContent, writeFileSync, instance, templateData, handleSetIsChatOpen]
    );

    const handleAcceptCode = useCallback(async () => {
        if (!pendingReview) return;
        setPendingReview(null);
        if (templateData) {
            const filesToSync = [...openFiles];
            if (activeFile && !filesToSync.some((f) => f.id === activeFile.id)) {
                filesToSync.push(activeFile);
            }
            const updated = updateTemplateTreeWithFiles(templateData, filesToSync);
            setTemplateData(updated);
            await saveTemplateData(updated);
        }
        toast.success("Changes accepted and saved.");
    }, [pendingReview, templateData, openFiles, activeFile, saveTemplateData, setTemplateData]);

    const handleRejectCode = useCallback(() => {
        if (!pendingReview) return;
        updateFileContent(pendingReview.fileId, pendingReview.originalContent);
        if (writeFileSync && instance && templateData && activeFile) {
            const path = findFilePath(activeFile, templateData);
            if (path) {
                writeFileSync(path.replace(/^\/+/, ""), pendingReview.originalContent);
            }
        }
        setPendingReview(null);
        toast.info("Changes reverted to previous version.");
    }, [pendingReview, updateFileContent, writeFileSync, instance, templateData, activeFile]);

    const handleReviewDiff = useCallback(
        (code: string) => {
            if (!activeFile) {
                toast.error("Please open an active file to review changes.");
                return;
            }
            const originalCode = pendingReview ? pendingReview.originalContent : activeFile.content;
            const modifiedCode = pendingReview ? activeFile.content : code;

            setDiffModalState({
                isOpen: true,
                filename: `${activeFile.filename}.${activeFile.fileExtension}`,
                originalCode,
                modifiedCode,
            });
        },
        [activeFile, pendingReview]
    );

    const handleAcceptDiff = useCallback(async () => {
        if (!activeFileId || !activeFile) return;
        const newCode = diffModalState.modifiedCode;
        updateFileContent(activeFileId, newCode);
        if (writeFileSync && instance && templateData) {
            const path = findFilePath(activeFile, templateData);
            if (path) {
                await writeFileSync(path.replace(/^\/+/, ""), newCode);
            }
        }
        if (templateData) {
            const filesToSync = openFiles.map((f) =>
                f.id === activeFileId ? { ...f, content: newCode } : f
            );
            const updated = updateTemplateTreeWithFiles(templateData, filesToSync);
            setTemplateData(updated);
            await saveTemplateData(updated);
        }
        setPendingReview(null);
        toast.success(`Accepted and saved to ${diffModalState.filename}`);
        setDiffModalState((prev) => ({ ...prev, isOpen: false }));
    }, [
        activeFileId,
        activeFile,
        diffModalState.modifiedCode,
        diffModalState.filename,
        updateFileContent,
        writeFileSync,
        instance,
        templateData,
        openFiles,
        saveTemplateData,
        setTemplateData,
    ]);

    const handleRejectDiff = useCallback(() => {
        if (pendingReview) {
            handleRejectCode();
        }
        setDiffModalState((prev) => ({ ...prev, isOpen: false }));
        toast.info("Proposed changes dismissed.");
    }, [pendingReview, handleRejectCode]);

    const handleExportZip = useCallback(async () => {
        if (!templateData) {
            toast.error("Project files are not loaded yet.");
            return;
        }
        try {
            setIsExportingZip(true);
            toast.loading("Packaging project as ZIP...", { id: "export-zip" });
            await exportProjectAsZip(templateData, playgroundData?.title || "project");
            toast.success("Project exported as ZIP", { id: "export-zip" });
        } catch (err) {
            console.error("ZIP export failed:", err);
            toast.error("Failed to export project as ZIP", { id: "export-zip" });
        } finally {
            setIsExportingZip(false);
        }
    }, [templateData, playgroundData]);

    const handleExplainTerminalError = useCallback(
        (errorLogs: string) => {
            const prompt = `I encountered this error in the terminal while running the project:\n\n\`\`\`\n${errorLogs}\n\`\`\`\n\nPlease diagnose the root cause and provide a surgical fix for the affected file.`;
            setTerminalDiagnosticPrompt(prompt);
            handleSetIsChatOpen(true);
            toast.info("Terminal error loaded into AI Assistant.", {
                description: "Review prompt and send to generate diagnosis.",
            });
        },
        [handleSetIsChatOpen]
    );

    // Save all changes across open files by default
    const handleSave = useCallback(async () => {
        if (!templateData) return;

        // Collect all open files that might have been modified
        const filesToSync = [...openFiles];
        if (activeFile && !filesToSync.some((f) => f.id === activeFile.id)) {
            filesToSync.push(activeFile);
        }

        // Deep-clone and update the tree with the latest contents from openFiles
        const updatedTemplate = updateTemplateTreeWithFiles(templateData, filesToSync);

        // Sync every modified file to WebContainer disk
        for (const file of filesToSync) {
            const currentContent = file.content;
            const lastSynced = lastSyncedContent.current.get(file.id);

            if (currentContent !== lastSynced) {
                if (writeFileSync && instance) {
                    const path = findFilePath(file, updatedTemplate);
                    if (path) {
                        try {
                            await writeFileSync(path, currentContent);
                            lastSyncedContent.current.set(file.id, currentContent);
                        } catch (err) {
                            console.error(`Error syncing ${path} to WebContainer:`, err);
                        }
                    }
                }
            }
        }

        // Persist the updated tree to the database!
        try {
            await saveTemplateData(updatedTemplate);
            setTemplateData(updatedTemplate);
            setLastSavedAt(Date.now());

            // Update originalContent and clear unsaved changes flags
            setOpenFiles(
                openFiles.map((file) => ({
                    ...file,
                    originalContent: file.content,
                    hasUnsavedChanges: false,
                }))
            );

            toast.success("All changes saved");
        } catch (err) {
            console.error("Save error:", err);
            toast.error("Failed to save changes");
        }
    }, [templateData, openFiles, activeFile, writeFileSync, instance, saveTemplateData, setTemplateData, setOpenFiles]);

    // Keyboard shortcuts for save
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if ((e.metaKey || e.ctrlKey) && e.key === "s") {
                e.preventDefault();
                handleSave();
            }
        };

        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [handleSave]);

    const hasUnsavedChanges = openFiles.some((file) => file.hasUnsavedChanges);

    if (isLoading) {
        return (
            <div className="flex flex-1 w-full min-h-screen flex-col items-center justify-center bg-background">
                <LoadingStep currentStep={1} step={1} label="Loading project playground..." />
            </div>
        );
    }

    if (error) {
        return (
            <div className="flex flex-1 w-full min-h-screen flex-col items-center justify-center bg-background p-6">
                <div className="text-center space-y-4 max-w-md">
                    <div className="flex items-center justify-center">
                        <AlertCircle className="h-12 w-12 text-destructive" />
                    </div>
                    <h1 className="text-2xl font-bold">Failed to load playground</h1>
                    <p className="text-muted-foreground">{error}</p>
                    <Button onClick={() => window.location.reload()}>Try Again</Button>
                </div>
            </div>
        );
    }

    return (
        <TooltipProvider>
            <>
                {templateData && (
                    <TemplateFileTree
                        data={templateData}
                        onFileSelect={openFile}
                        selectedFile={activeFile}
                        onAddFile={wrappedHandleAddFile}
                        onAddFolder={wrappedHandleAddFolder}
                        onDeleteFile={wrappedHandleDeleteFile}
                        onDeleteFolder={wrappedHandleDeleteFolder}
                        onRenameFile={wrappedHandleRenameFile}
                        onRenameFolder={wrappedHandleRenameFolder}
                    />
                )}
                                <SidebarInset className="flex flex-col h-screen overflow-hidden bg-background border-l border-zinc-300 dark:border-zinc-800">
                    {/* Workspace Top Header (h-13 / 52px matches explorer bar) */}
                    <header className="flex h-13 shrink-0 items-center justify-between border-b border-zinc-300 dark:border-zinc-800 px-4 bg-white dark:bg-zinc-950 select-none transition-colors">
                        <div className="flex items-center gap-2.5 min-w-0">
                            {!open && (
                                <SidebarTrigger className="h-8 w-8 border-0 bg-transparent text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-md" />
                            )}

                            {/* Back to Dashboard Button */}
                            <Tooltip>
                                <TooltipTrigger
                                    render={
                                        <Link
                                            href="/dashboard"
                                            className="h-8 w-8 rounded-md flex items-center justify-center text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors shrink-0"
                                            aria-label="Back to Dashboard"
                                        >
                                            <ArrowLeft className="h-4 w-4" />
                                        </Link>
                                    }
                                />
                                <TooltipContent side="bottom" className="text-xs">
                                    Back to Dashboard
                                </TooltipContent>
                            </Tooltip>

                            {/* PoiEx Brand Logo */}
                            <Link
                                href="/dashboard"
                                className="flex items-center gap-1.5 hover:opacity-80 transition-opacity shrink-0"
                                title="PoiEx Dashboard"
                            >
                                <Image
                                    src="/logo.svg"
                                    alt="PoiEx"
                                    width={24}
                                    height={24}
                                    className="h-6 w-6 object-contain"
                                />
                            </Link>

                            <span className="text-zinc-300 dark:text-zinc-700 font-light select-none text-sm">/</span>

                            {/* User Profile Avatar */}
                            <Avatar className="h-6 w-6 shrink-0 ring-1 ring-zinc-300 dark:ring-zinc-700" title={user?.name || "User"}>
                                <AvatarImage src={user?.image ?? undefined} alt={user?.name ?? undefined} />
                                <AvatarFallback className="bg-purple-600 text-white text-[11px] font-semibold">
                                    {user?.name ? user.name.charAt(0).toUpperCase() : "U"}
                                </AvatarFallback>
                            </Avatar>

                            <span className="text-zinc-300 dark:text-zinc-700 font-light select-none text-sm">/</span>

                            {/* Project Name with Icon */}
                            <div className="flex items-center gap-2 text-zinc-900 dark:text-zinc-100 font-semibold text-xs select-none truncate">
                                <FolderOpen className="h-3.5 w-3.5 text-zinc-500 dark:text-zinc-400 shrink-0" />
                                <span className="truncate">{playgroundData?.title || "Project Playground"}</span>
                            </div>
                        </div>

                        <div className="flex items-center gap-2">
                            <Tooltip>
                                <TooltipTrigger
                                    render={
                                        <Button
                                            size="sm"
                                            variant="outline"
                                            onClick={handleSave}
                                            disabled={!hasUnsavedChanges}
                                            className={cn(
                                                "h-8 px-3 text-xs font-medium rounded-md gap-1.5 transition-colors",
                                                hasUnsavedChanges
                                                    ? "border-amber-500/60 text-amber-700 dark:text-amber-300 bg-amber-50/50 dark:bg-amber-500/10 hover:bg-amber-100/60 dark:hover:bg-amber-500/20"
                                                    : "border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:text-zinc-950 dark:hover:text-zinc-100"
                                            )}
                                        >
                                            <Save className="h-3.5 w-3.5" />
                                            <span>Save</span>
                                            {hasUnsavedChanges && (
                                                <span className="h-1.5 w-1.5 rounded-full bg-amber-400 animate-pulse" />
                                            )}
                                        </Button>
                                    }
                                />
                                <TooltipContent side="bottom" className="text-xs">Save all changes (Ctrl+S)</TooltipContent>
                            </Tooltip>

                            <Tooltip>
                                <TooltipTrigger
                                    render={
                                        <Button
                                            size="sm"
                                            variant="outline"
                                            onClick={handleExportZip}
                                            disabled={isExportingZip}
                                            className="h-8 px-2.5 text-xs font-medium rounded-md gap-1.5 border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:text-zinc-950 dark:hover:text-zinc-100 transition-colors"
                                        >
                                            <Download className="h-3.5 w-3.5" />
                                            <span className="hidden md:inline">Export ZIP</span>
                                        </Button>
                                    }
                                />
                                <TooltipContent side="bottom" className="text-xs">Download project as ready-to-run ZIP</TooltipContent>
                            </Tooltip>

                            <ToggleAI
                                isEnabled={aiSuggestions.isEnabled}
                                onToggle={aiSuggestions.toggleEnabled}
                                suggestionLoading={aiSuggestions.isLoading}
                                onOpenChat={() => handleSetIsChatOpen(true)}
                            />

                            <ThemeToggle />

                            <DropdownMenu>
                                <DropdownMenuTrigger
                                    render={
                                        <Button size="sm" variant="outline" className="h-8 w-8 p-0 border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors">
                                            <Settings className="h-3.5 w-3.5" />
                                        </Button>
                                    }
                                />
                                <DropdownMenuContent
                                    align="end"
                                    className="w-56 p-1.5 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-zinc-100 shadow-xl rounded-xl font-sans"
                                >
                                    <DropdownMenuGroup>
                                        <DropdownMenuItem
                                            onClick={togglePreview}
                                            className="cursor-pointer text-xs py-2 px-2.5 rounded-lg text-zinc-700 dark:text-zinc-300 hover:text-zinc-950 dark:hover:text-zinc-100 focus:bg-zinc-100 dark:focus:bg-zinc-800 focus:text-zinc-950 dark:focus:text-zinc-100 flex items-center gap-2.5 transition-colors"
                                        >
                                            {isPreviewVisible ? (
                                                <EyeOff className="h-3.5 w-3.5 text-zinc-400 shrink-0" />
                                            ) : (
                                                <Eye className="h-3.5 w-3.5 text-zinc-400 shrink-0" />
                                            )}
                                            <span>{isPreviewVisible ? "Hide Preview" : "Show Preview"}</span>
                                        </DropdownMenuItem>

                                        <DropdownMenuSub>
                                            <DropdownMenuSubTrigger
                                                className="cursor-pointer text-xs py-2 px-2.5 rounded-lg text-zinc-700 dark:text-zinc-300 hover:text-zinc-950 dark:hover:text-zinc-100 focus:bg-zinc-100 dark:focus:bg-zinc-800 focus:text-zinc-950 dark:focus:text-zinc-100 data-popup-open:bg-zinc-100 dark:data-popup-open:bg-zinc-800 data-popup-open:text-zinc-950 dark:data-popup-open:text-zinc-100 data-open:bg-zinc-100 dark:data-open:bg-zinc-800 data-open:text-zinc-950 dark:data-open:text-zinc-100 flex items-center gap-2.5 transition-colors"
                                            >
                                                <Palette className="h-3.5 w-3.5 text-zinc-400 shrink-0" />
                                                <span>Editor Theme</span>
                                            </DropdownMenuSubTrigger>
                                            <DropdownMenuSubContent
                                                className="w-48 p-1.5 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-zinc-100 shadow-xl rounded-xl font-sans"
                                            >
                                                <DropdownMenuLabel className="px-2.5 py-1 text-[10px] font-semibold text-zinc-400 tracking-wider uppercase font-mono">
                                                    Themes
                                                </DropdownMenuLabel>
                                                {EDITOR_THEMES.map((theme) => (
                                                    <DropdownMenuItem
                                                        key={theme.id}
                                                        onClick={() => setEditorThemePreference(theme.id)}
                                                        className="cursor-pointer text-xs py-1.5 px-2.5 rounded-lg text-zinc-700 dark:text-zinc-300 hover:text-zinc-950 dark:hover:text-zinc-100 focus:bg-zinc-100 dark:focus:bg-zinc-800 focus:text-zinc-950 dark:focus:text-zinc-100 flex items-center justify-between gap-3 transition-colors"
                                                    >
                                                        <div className="flex items-center gap-2 min-w-0">
                                                            <span
                                                                className="h-3 w-3 rounded-full border border-zinc-700 shrink-0 shadow-inner"
                                                                style={{ backgroundColor: theme.previewBg }}
                                                            />
                                                            <span className="truncate">{theme.label}</span>
                                                        </div>
                                                        {activeEditorTheme === theme.id && (
                                                            <Check className="h-3.5 w-3.5 text-zinc-900 dark:text-zinc-100 shrink-0" />
                                                        )}
                                                    </DropdownMenuItem>
                                                ))}
                                            </DropdownMenuSubContent>
                                        </DropdownMenuSub>
                                    </DropdownMenuGroup>

                                    <DropdownMenuSeparator className="my-1.5 bg-zinc-200 dark:bg-zinc-800" />

                                    <DropdownMenuGroup>
                                        <DropdownMenuLabel className="px-2.5 py-1 text-[10px] font-semibold text-zinc-500 dark:text-zinc-400 tracking-wider uppercase font-mono">
                                            Actions
                                        </DropdownMenuLabel>
                                        <DropdownMenuItem
                                            onClick={closeAllFiles}
                                            className="cursor-pointer text-xs py-2 px-2.5 rounded-lg text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 focus:bg-red-50 dark:focus:bg-red-950/30 focus:text-red-700 dark:focus:text-red-300 flex items-center gap-2.5 transition-colors"
                                        >
                                            <FileX className="h-3.5 w-3.5 text-red-600 dark:text-red-400 shrink-0" />
                                            <span>Close All Files</span>
                                        </DropdownMenuItem>
                                    </DropdownMenuGroup>
                                </DropdownMenuContent>
                            </DropdownMenu>
                        </div>
                    </header>

                    {/* Resizable Editor & Preview/Terminal Workspace */}
                    <div className="flex-1 min-h-0 w-full overflow-hidden">
                        <ResizablePanelGroup
                            orientation="horizontal"
                            className="h-full w-full"
                        >
                            {/* Editor Panel */}
                            <ResizablePanel
                                id="editor-panel"
                                defaultSize={50}
                                minSize={25}
                            >
                                {openFiles.length > 0 ? (
                                    <div className="h-full flex flex-col bg-white dark:bg-[#0d1117] transition-colors">
                                        {/* Editor Tab Bar */}
                                        <div className="h-9 shrink-0 bg-zinc-100 dark:bg-[#0e0e11] border-b border-zinc-300 dark:border-zinc-800 flex items-center justify-between px-0 select-none overflow-x-auto no-scrollbar transition-colors">
                                            <div className="flex items-center h-full">
                                                {openFiles.map((file) => {
                                                    const isActive = file.id === activeFileId;
                                                    return (
                                                        <div
                                                            key={file.id}
                                                            role="button"
                                                            tabIndex={0}
                                                            onClick={() => setActiveFileId(file.id)}
                                                            onKeyDown={(e) => {
                                                                if (e.key === "Enter" || e.key === " ") {
                                                                    e.preventDefault();
                                                                    setActiveFileId(file.id);
                                                                }
                                                            }}
                                                            className={cn(
                                                                "group relative h-9 px-3.5 flex items-center gap-2 border-r border-zinc-300 dark:border-zinc-800 select-none cursor-pointer transition-colors duration-100 shrink-0",
                                                                isActive
                                                                    ? "bg-white dark:bg-[#0d1117] text-zinc-900 dark:text-zinc-100 font-medium border-t-2 border-t-[#e93f3f] shadow-xs"
                                                                    : "bg-transparent hover:bg-zinc-200/60 dark:hover:bg-white/3 text-zinc-600 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-zinc-200 border-t-2 border-t-transparent font-normal"
                                                            )}
                                                        >
                                                            <FileText className="h-3 w-3" />
                                                            <span className="text-xs max-w-37.5 truncate">
                                                                {file.filename}.{file.fileExtension}
                                                            </span>

                                                            {file.hasUnsavedChanges && (
                                                                <span
                                                                    className="h-1.5 w-1.5 rounded-full bg-amber-400 shrink-0"
                                                                    title="Unsaved changes"
                                                                />
                                                            )}

                                                            <span
                                                                role="button"
                                                                tabIndex={0}
                                                                aria-label={`Close ${file.filename}.${file.fileExtension}`}
                                                                className="ml-1 h-4 w-4 rounded flex items-center justify-center text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-200 dark:hover:bg-zinc-800 transition-colors cursor-pointer opacity-0 group-hover:opacity-100 focus-visible:opacity-100"
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    closeFile(file.id);
                                                                }}
                                                                onKeyDown={(e) => {
                                                                    if (e.key === "Enter" || e.key === " ") {
                                                                        e.preventDefault();
                                                                        e.stopPropagation();
                                                                        closeFile(file.id);
                                                                    }
                                                                }}
                                                            >
                                                                <X className="h-3 w-3" />
                                                            </span>
                                                        </div>
                                                    );
                                                })}
                                            </div>

                                            {openFiles.length > 1 && (
                                                <Button
                                                    size="sm"
                                                    variant="ghost"
                                                    onClick={closeAllFiles}
                                                    className="h-6 px-2 mr-2 text-[11px] text-zinc-600 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-zinc-100 hover:bg-zinc-200 dark:hover:bg-zinc-800/60 rounded"
                                                >
                                                    Close All
                                                </Button>
                                            )}
                                        </div>

                                        {/* Breadcrumb Trail */}
                                        {activeFile && (
                                            <div className="h-7 shrink-0 bg-zinc-50 dark:bg-[#0d1117] border-b border-zinc-300 dark:border-zinc-800/60 px-3 flex items-center gap-1.5 text-[11px] font-mono select-none text-zinc-600 dark:text-zinc-400 transition-colors">
                                                <span className="text-zinc-500 font-sans">{playgroundData?.title || "project"}</span>
                                                {(() => {
                                                    const activePath = templateData ? findFilePath(activeFile, templateData) : null;
                                                    const segments = activePath ? activePath.split("/") : [`${activeFile.filename}.${activeFile.fileExtension}`];
                                                    return segments.map((seg, idx) => {
                                                        const isLast = idx === segments.length - 1;
                                                        return (
                                                            <React.Fragment key={idx}>
                                                                <ChevronRight className="h-3 w-3 text-zinc-400 dark:text-zinc-600 shrink-0" />
                                                                {isLast ? (
                                                                    <div className="flex items-center gap-1.5 text-zinc-900 dark:text-zinc-200 font-medium">
                                                                        <FileText className="h-3 w-3 text-zinc-500 dark:text-zinc-400" />
                                                                        <span>{seg}</span>
                                                                    </div>
                                                                ) : (
                                                                    <span className="text-zinc-600 dark:text-zinc-400">{seg}</span>
                                                                )}
                                                            </React.Fragment>
                                                        );
                                                    });
                                                })()}
                                            </div>
                                        )}

                                        <div className="flex-1 min-h-0 relative bg-[#FAFBFC] dark:bg-[#0d1117] transition-colors">
                                            {/* Floating In-Editor Review HUD (Thinner Oval Pill with Proper Naming) */}
                                            {pendingReview && pendingReview.fileId === activeFileId && (
                                                <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-30 pointer-events-auto flex items-center gap-2 h-8 px-3 rounded-full bg-zinc-950/95 dark:bg-[#121316]/95 backdrop-blur-md border border-zinc-700/80 shadow-[0_8px_24px_rgba(0,0,0,0.5)] text-xs whitespace-nowrap select-none animate-in fade-in slide-in-from-bottom-2 duration-150">
                                                    <div className="flex items-center gap-1.5 font-mono text-[11px]">
                                                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 shrink-0 animate-pulse" />
                                                        <span className="font-semibold text-zinc-100">{pendingReview.filename}</span>
                                                        <span className="text-zinc-400">modified</span>
                                                    </div>

                                                    <div className="h-3.5 w-px bg-zinc-700/80 mx-0.5 shrink-0" />

                                                    <div className="flex items-center gap-1">
                                                        <Button
                                                            size="sm"
                                                            variant="ghost"
                                                            onClick={() => handleReviewDiff(activeFile?.content || "")}
                                                            className="h-6 px-2 text-[11px] font-medium text-zinc-300 hover:text-white hover:bg-zinc-800 rounded-full transition-colors flex items-center gap-1 whitespace-nowrap focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-zinc-400"
                                                            title="Review side-by-side diff"
                                                        >
                                                            <ArrowLeftRight className="h-2.5 w-2.5 text-cyan-400" />
                                                            <span>Diff</span>
                                                        </Button>
                                                        <Button
                                                            size="sm"
                                                            variant="ghost"
                                                            onClick={handleRejectCode}
                                                            className="h-6 px-2 text-[11px] font-medium text-zinc-400 hover:text-rose-400 hover:bg-rose-500/15 rounded-full transition-colors flex items-center gap-1 whitespace-nowrap focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-rose-400"
                                                            title="Revert changes"
                                                        >
                                                            <RotateCcw className="h-2.5 w-2.5" />
                                                            <span>Revert</span>
                                                        </Button>
                                                        <Button
                                                            size="sm"
                                                            onClick={handleAcceptCode}
                                                            className="h-6 px-2.5 text-[11px] font-medium bg-emerald-600 hover:bg-emerald-500 text-white rounded-full shadow-xs flex items-center gap-1 transition-all whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
                                                            title="Accept and keep changes"
                                                        >
                                                            <Check className="h-2.5 w-2.5" />
                                                            <span>Keep</span>
                                                        </Button>
                                                    </div>
                                                </div>
                                            )}

                                            <PlaygroundEditor
                                                activeFile={activeFile}
                                                content={activeFile?.content || ""}
                                                onContentChange={(value) =>
                                                    activeFileId && updateFileContent(activeFileId, value)
                                                }
                                                isAIEnabled={aiSuggestions.isEnabled}
                                                editorTheme={activeEditorTheme}
                                            />
                                        </div>
                                    </div>
                                ) : (
                                    <div className="flex flex-col h-full items-center justify-center text-muted-foreground p-8 select-none bg-zinc-50/70 dark:bg-[#0d1117] transition-colors">
                                        <div className="flex flex-col items-center max-w-sm text-center">
                                            <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/50 shadow-xs mb-4">
                                                <FileText className="h-8 w-8 text-zinc-400 dark:text-zinc-500" />
                                            </div>
                                            <h3 className="text-base font-semibold text-zinc-800 dark:text-zinc-200 tracking-tight">
                                                No files open
                                            </h3>
                                            <p className="mt-1.5 text-sm text-zinc-500 dark:text-zinc-400">
                                                Select a file from the explorer sidebar to view or edit code
                                            </p>
                                        </div>
                                    </div>
                                )}
                            </ResizablePanel>

                            {/* Resizable Handle between Editor and Live Preview */}
                            <ResizableHandle
                                withHandle
                                disabled={!isPreviewVisible}
                                className={cn(!isPreviewVisible && "hidden")}
                            />

                            {/* Live Preview Panel (Kept permanently mounted to preserve WebContainer session & terminal) */}
                            <ResizablePanel
                                id="preview-panel"
                                panelRef={previewPanelRef}
                                defaultSize={50}
                                minSize={20}
                                collapsible={true}
                                collapsedSize={0}
                                onResize={(panelSize) => {
                                    const isExpanded = panelSize.asPercentage > 0;
                                    setIsPreviewVisible((prev) => {
                                        if (prev !== isExpanded) {
                                            try {
                                                localStorage.setItem(`poiex-preview-visible-${id}`, String(isExpanded));
                                            } catch {}
                                            return isExpanded;
                                        }
                                        return prev;
                                    });
                                }}
                                className={cn(
                                    "overflow-hidden",
                                    !isPreviewVisible && "pointer-events-none"
                                )}
                            >
                                <div
                                    className={cn(
                                        "h-full w-full",
                                        !isPreviewVisible && "invisible pointer-events-none"
                                    )}
                                >
                                    <WebContainerPreview
                                        key={id}
                                        playgroundId={id}
                                        templateData={templateData!}
                                        instance={instance}
                                        writeFileSync={writeFileSync}
                                        isLoading={containerLoading}
                                        error={containerError}
                                        serverUrl={serverUrl!}
                                        forceResetup={false}
                                        lastSavedAt={lastSavedAt}
                                        onExplainError={handleExplainTerminalError}
                                    />
                                </div>
                            </ResizablePanel>
                        </ResizablePanelGroup>
                    </div>

                    {/* Dedicated AI Chat Window (Slide-Over Overlay) */}
                    <AIChatSidePanel
                        isOpen={isChatOpen}
                        onClose={() => handleSetIsChatOpen(false)}
                        activeFileName={
                            activeFile
                                ? `${activeFile.filename}.${activeFile.fileExtension}`
                                : undefined
                        }
                        activeFileContent={activeFile?.content}
                        onApplyCode={handleApplyCode}
                        onReviewDiff={handleReviewDiff}
                        initialPrompt={terminalDiagnosticPrompt}
                        initialMode={terminalDiagnosticPrompt ? "fix" : "chat"}
                        isDocked={false}
                        playgroundId={id}
                    />

                    {/* Side-by-Side Monaco Code Diff Modal */}
                    <CodeDiffModal
                        isOpen={diffModalState.isOpen}
                        onClose={() => setDiffModalState((prev) => ({ ...prev, isOpen: false }))}
                        filename={diffModalState.filename}
                        originalCode={diffModalState.originalCode}
                        modifiedCode={diffModalState.modifiedCode}
                        onAccept={handleAcceptDiff}
                        onReject={handleRejectDiff}
                        theme={activeEditorTheme}
                    />
                </SidebarInset>
            </>
        </TooltipProvider>
    );
};

export default MainPlaygroundPage;
