"use client";

import * as React from "react";
import {
    ChevronRight,
    File,
    Folder,
    FolderOpen,
    FolderTree,
    Plus,
    FilePlus,
    FolderPlus,
    MoreHorizontal,
    Trash2,
    Edit3,
} from "lucide-react";

import {
    Sidebar,
    SidebarContent,
    SidebarGroup,
    SidebarRail,
    SidebarTrigger,
} from "@/components/ui/sidebar";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
    DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import RenameFolderDialog from "./dialogs/rename-folder-dialog";
import NewFolderDialog from "./dialogs/new-folder-dialog";
import NewFileDialog from "./dialogs/new-file-dialog";
import RenameFileDialog from "./dialogs/rename-file-dialog";
import { DeleteDialog } from "./dialogs/delete-dialog";
import type {
    TemplateFile,
    TemplateFolder,
} from "../lib/path-to-json";

type TemplateItem = TemplateFile | TemplateFolder;

interface TemplateFileTreeProps {
    data: TemplateItem;
    onFileSelect?: (file: TemplateFile) => void;
    selectedFile?: TemplateFile;
    title?: string;
    onAddFile?: (file: TemplateFile, parentPath: string) => void;
    onAddFolder?: (folder: TemplateFolder, parentPath: string) => void;
    onDeleteFile?: (file: TemplateFile, parentPath: string) => void;
    onDeleteFolder?: (folder: TemplateFolder, parentPath: string) => void;
    onRenameFile?: (
        file: TemplateFile,
        newFilename: string,
        newExtension: string,
        parentPath: string
    ) => void;
    onRenameFolder?: (
        folder: TemplateFolder,
        newFolderName: string,
        parentPath: string
    ) => void;
}

export function TemplateFileTree({
    data,
    onFileSelect,
    selectedFile,
    onAddFile,
    onAddFolder,
    onDeleteFile,
    onDeleteFolder,
    onRenameFile,
    onRenameFolder,
}: TemplateFileTreeProps) {
    const isRootFolder = Boolean(data && typeof data === "object" && "folderName" in data);
    const [isNewFileDialogOpen, setIsNewFileDialogOpen] = React.useState(false);
    const [isNewFolderDialogOpen, setIsNewFolderDialogOpen] =
        React.useState(false);

    const handleAddRootFile = (e: React.MouseEvent) => {
        e.stopPropagation();
        setIsNewFileDialogOpen(true);
    };

    const handleAddRootFolder = (e: React.MouseEvent) => {
        e.stopPropagation();
        setIsNewFolderDialogOpen(true);
    };

    const handleCreateFile = (filename: string, extension: string) => {
        if (onAddFile && isRootFolder) {
            const newFile: TemplateFile = {
                filename,
                fileExtension: extension,
                content: "",
            };
            onAddFile(newFile, "");
        }
        setIsNewFileDialogOpen(false);
    };

    const handleCreateFolder = (folderName: string) => {
        if (onAddFolder && isRootFolder) {
            const newFolder: TemplateFolder = {
                folderName,
                items: [],
            };
            onAddFolder(newFolder, "");
        }
        setIsNewFolderDialogOpen(false);
    };

    return (
        <Sidebar className="border-r border-zinc-300 dark:border-zinc-800 bg-white dark:bg-[#0c0c0e] text-zinc-800 dark:text-zinc-300 transition-colors">
            {/* Header: StackBlitz-style Files Bar (h-13 / 52px matches top nav) */}
            <div className="flex h-13 shrink-0 items-center justify-between border-b border-zinc-300 dark:border-zinc-800 bg-zinc-100/70 dark:bg-[#09090b] px-3.5 select-none transition-colors">
                <div className="flex items-center gap-2 text-xs font-semibold text-zinc-800 dark:text-zinc-200">
                    <FolderTree className="h-4 w-4 text-zinc-500 dark:text-zinc-400" />
                    <span>Files Explorer</span>
                </div>
                <div className="flex items-center gap-1">
                    <DropdownMenu>
                        <DropdownMenuTrigger
                            render={
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    aria-label="Create file or folder"
                                    className="h-8 w-8 text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-200/70 dark:hover:bg-zinc-800 rounded-md transition-colors"
                                >
                                    <Plus className="h-4 w-4" />
                                </Button>
                            }
                        />
                        <DropdownMenuContent
                            align="end"
                            className="w-40 p-1 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-800 dark:text-zinc-200 shadow-xl rounded-lg font-sans"
                        >
                            <DropdownMenuItem
                                onClick={handleAddRootFile}
                                className="cursor-pointer text-xs py-1.5 px-2.5 rounded text-zinc-700 dark:text-zinc-300 hover:text-zinc-950 dark:hover:text-zinc-100 focus:bg-zinc-100 dark:focus:bg-zinc-800 focus:text-zinc-950 dark:focus:text-zinc-100 flex items-center gap-2 transition-colors"
                            >
                                <FilePlus className="h-3.5 w-3.5 text-zinc-500 dark:text-zinc-400" />
                                <span>Create File</span>
                            </DropdownMenuItem>
                            <DropdownMenuItem
                                onClick={handleAddRootFolder}
                                className="cursor-pointer text-xs py-1.5 px-2.5 rounded text-zinc-700 dark:text-zinc-300 hover:text-zinc-950 dark:hover:text-zinc-100 focus:bg-zinc-100 dark:focus:bg-zinc-800 focus:text-zinc-950 dark:focus:text-zinc-100 flex items-center gap-2 transition-colors"
                            >
                                <FolderPlus className="h-3.5 w-3.5 text-zinc-500 dark:text-zinc-400" />
                                <span>Create Folder</span>
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>

                    <SidebarTrigger className="h-8 w-8 border-0 bg-transparent text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-200/70 dark:hover:bg-zinc-800 rounded-md" />
                </div>
            </div>

            <SidebarContent className="no-scrollbar overflow-y-auto overflow-x-hidden">
                <SidebarGroup className="p-0">
                    <div className="flex flex-col w-full py-1">
                        {isRootFolder ? (
                            (data as TemplateFolder).items.map((child) => {
                                const key =
                                    "folderName" in child
                                        ? `folder-${child.folderName}`
                                        : `file-${child.filename}.${child.fileExtension}`;
                                return (
                                    <TemplateNode
                                        key={key}
                                        item={child}
                                        onFileSelect={onFileSelect}
                                        selectedFile={selectedFile}
                                        level={0}
                                        path=""
                                        onAddFile={onAddFile}
                                        onAddFolder={onAddFolder}
                                        onDeleteFile={onDeleteFile}
                                        onDeleteFolder={onDeleteFolder}
                                        onRenameFile={onRenameFile}
                                        onRenameFolder={onRenameFolder}
                                    />
                                );
                            })
                        ) : (
                            <TemplateNode
                                item={data}
                                onFileSelect={onFileSelect}
                                selectedFile={selectedFile}
                                level={0}
                                path=""
                                onAddFile={onAddFile}
                                onAddFolder={onAddFolder}
                                onDeleteFile={onDeleteFile}
                                onDeleteFolder={onDeleteFolder}
                                onRenameFile={onRenameFile}
                                onRenameFolder={onRenameFolder}
                            />
                        )}
                    </div>
                </SidebarGroup>
            </SidebarContent>
            <SidebarRail />

            <NewFileDialog
                isOpen={isNewFileDialogOpen}
                onClose={() => setIsNewFileDialogOpen(false)}
                onCreateFile={handleCreateFile}
            />

            <NewFolderDialog
                isOpen={isNewFolderDialogOpen}
                onClose={() => setIsNewFolderDialogOpen(false)}
                onCreateFolder={handleCreateFolder}
            />
        </Sidebar>
    );
}

interface TemplateNodeProps {
    item: TemplateItem;
    onFileSelect?: (file: TemplateFile) => void;
    selectedFile?: TemplateFile;
    level: number;
    path?: string;
    onAddFile?: (file: TemplateFile, parentPath: string) => void;
    onAddFolder?: (folder: TemplateFolder, parentPath: string) => void;
    onDeleteFile?: (file: TemplateFile, parentPath: string) => void;
    onDeleteFolder?: (folder: TemplateFolder, parentPath: string) => void;
    onRenameFile?: (
        file: TemplateFile,
        newFilename: string,
        newExtension: string,
        parentPath: string
    ) => void;
    onRenameFolder?: (
        folder: TemplateFolder,
        newFolderName: string,
        parentPath: string
    ) => void;
}

function TemplateNode({
    item,
    onFileSelect,
    selectedFile,
    level,
    path = "",
    onAddFile,
    onAddFolder,
    onDeleteFile,
    onDeleteFolder,
    onRenameFile,
    onRenameFolder,
}: TemplateNodeProps) {
    const isValidItem = Boolean(item && typeof item === "object");
    const isFolder = isValidItem && "folderName" in item;
    const [isNewFileDialogOpen, setIsNewFileDialogOpen] = React.useState(false);
    const [isNewFolderDialogOpen, setIsNewFolderDialogOpen] =
        React.useState(false);
    const [isRenameDialogOpen, setIsRenameDialogOpen] = React.useState(false);
    const [isDeleteDialogOpen, setIsDeleteDialogOpen] = React.useState(false);
    const [isOpen, setIsOpen] = React.useState(level < 2);

    if (!isValidItem) return null;

    if (!isFolder) {
        const file = item as TemplateFile;
        const fileName = `${file.filename}.${file.fileExtension}`;

        const selectedFileId = (selectedFile as { id?: string } | undefined)?.id;
        const fileId = (file as { id?: string }).id;
        const isSelected = Boolean(
            (selectedFileId && fileId && selectedFileId === fileId) ||
            (selectedFile &&
                selectedFile.filename === file.filename &&
                selectedFile.fileExtension === file.fileExtension)
        );

        const handleRename = () => {
            setIsRenameDialogOpen(true);
        };

        const handleDelete = () => {
            setIsDeleteDialogOpen(true);
        };

        const confirmDelete = () => {
            onDeleteFile?.(file, path);
            setIsDeleteDialogOpen(false);
        };

        const handleRenameSubmit = (newFilename: string, newExtension: string) => {
            onRenameFile?.(file, newFilename, newExtension, path);
            setIsRenameDialogOpen(false);
        };

        return (
            <div className="relative w-full">
                <div
                    role="button"
                    tabIndex={0}
                    onClick={() => onFileSelect?.(file)}
                    onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            onFileSelect?.(file);
                        }
                    }}
                    style={{ paddingLeft: `${14 + level * 16}px` }}
                    className={cn(
                        "group relative flex h-7.5 w-full items-center justify-between pr-2 text-[13px] select-none cursor-pointer rounded-none transition-colors duration-100",
                        isSelected
                            ? "bg-zinc-200/90 dark:bg-zinc-800 text-zinc-950 dark:text-zinc-100 font-semibold before:absolute before:left-0 before:top-0 before:bottom-0 before:w-0.75 before:bg-[#e93f3f]"
                            : "text-zinc-800 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800/60 hover:text-zinc-950 dark:hover:text-zinc-100 font-normal"
                    )}
                >
                    <div className="flex items-center gap-2 min-w-0 flex-1 py-1">
                        <File className={cn("h-4 w-4 mr-2 shrink-0", isSelected ? "text-zinc-950 dark:text-zinc-100" : "text-zinc-500 dark:text-zinc-400")} />
                        <span className="truncate">{fileName}</span>
                    </div>

                    <DropdownMenu>
                        <DropdownMenuTrigger
                            render={
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    aria-label={`Options for ${fileName}`}
                                    onClick={(e) => e.stopPropagation()}
                                    className="h-5 w-5 text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-200 dark:hover:bg-zinc-800 rounded opacity-0 group-hover:opacity-100 focus-visible:opacity-100 transition-opacity"
                                >
                                    <MoreHorizontal className="h-3.5 w-3.5" />
                                </Button>
                            }
                        />
                        <DropdownMenuContent
                            align="end"
                            className="w-40 p-1 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-800 dark:text-zinc-200 shadow-xl rounded-lg font-sans"
                        >
                            <DropdownMenuItem
                                onClick={handleRename}
                                className="cursor-pointer text-xs py-1.5 px-2.5 rounded text-zinc-700 dark:text-zinc-300 hover:text-zinc-950 dark:hover:text-zinc-100 focus:bg-zinc-100 dark:focus:bg-zinc-800 focus:text-zinc-950 dark:focus:text-zinc-100 flex items-center gap-2 transition-colors"
                            >
                                <Edit3 className="h-3.5 w-3.5 text-zinc-500 dark:text-zinc-400" />
                                <span>Rename</span>
                            </DropdownMenuItem>
                            <DropdownMenuSeparator className="my-1 bg-zinc-200 dark:bg-zinc-800" />
                            <DropdownMenuItem
                                onClick={handleDelete}
                                className="cursor-pointer text-xs py-1.5 px-2.5 rounded text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 focus:bg-red-50 dark:focus:bg-red-950/30 focus:text-red-700 dark:focus:text-red-300 flex items-center gap-2 transition-colors"
                            >
                                <Trash2 className="h-3.5 w-3.5" />
                                <span>Delete</span>
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>

                <RenameFileDialog
                    isOpen={isRenameDialogOpen}
                    onClose={() => setIsRenameDialogOpen(false)}
                    onRename={handleRenameSubmit}
                    currentFilename={file.filename}
                    currentExtension={file.fileExtension}
                />

                <DeleteDialog
                    isOpen={isDeleteDialogOpen}
                    setIsOpen={setIsDeleteDialogOpen}
                    onConfirm={confirmDelete}
                    title="Delete File"
                    description={`Are you sure you want to delete "${fileName}"? This action cannot be undone.`}
                    itemName={fileName}
                    confirmLabel="Delete"
                    cancelLabel="Cancel"
                />
            </div>
        );
    } else {
        const folder = item as TemplateFolder;
        const folderName = folder.folderName;
        const currentPath = path ? `${path}/${folderName}` : folderName;

        const handleAddFile = (e: React.MouseEvent) => {
            e.stopPropagation();
            setIsNewFileDialogOpen(true);
        };

        const handleAddFolder = (e: React.MouseEvent) => {
            e.stopPropagation();
            setIsNewFolderDialogOpen(true);
        };

        const handleRename = () => {
            setIsRenameDialogOpen(true);
        };

        const handleDelete = () => {
            setIsDeleteDialogOpen(true);
        };

        const confirmDelete = () => {
            onDeleteFolder?.(folder, path);
            setIsDeleteDialogOpen(false);
        };

        const handleCreateFile = (filename: string, extension: string) => {
            if (onAddFile) {
                const newFile: TemplateFile = {
                    filename,
                    fileExtension: extension,
                    content: "",
                };
                onAddFile(newFile, currentPath);
            }
            setIsNewFileDialogOpen(false);
        };

        const handleCreateFolder = (folderName: string) => {
            if (onAddFolder) {
                const newFolder: TemplateFolder = {
                    folderName,
                    items: [],
                };
                onAddFolder(newFolder, currentPath);
            }
            setIsNewFolderDialogOpen(false);
        };

        const handleRenameSubmit = (newFolderName: string) => {
            onRenameFolder?.(folder, newFolderName, path);
            setIsRenameDialogOpen(false);
        };

        return (
            <div className="relative w-full">
                <div
                    role="button"
                    tabIndex={0}
                    onClick={() => setIsOpen(!isOpen)}
                    onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            setIsOpen(!isOpen);
                        }
                    }}
                    style={{ paddingLeft: `${10 + level * 16}px` }}
                    className="group relative flex h-7.5 w-full items-center justify-between pr-2 text-[13px] text-zinc-800 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800/60 hover:text-zinc-950 dark:hover:text-zinc-100 select-none cursor-pointer rounded-none transition-colors duration-100 font-medium"
                >
                    <div className="flex items-center gap-1.5 min-w-0 flex-1 py-1">
                        <ChevronRight
                            className={cn(
                                "h-3.5 w-3.5 text-zinc-400 dark:text-zinc-500 transition-transform duration-150 shrink-0",
                                isOpen && "rotate-90 text-zinc-600 dark:text-zinc-400"
                            )}
                        />
                        {isOpen ? (
                            <FolderOpen className="h-4 w-4 shrink-0 text-zinc-600 dark:text-zinc-400" />
                        ) : (
                            <Folder className="h-4 w-4 shrink-0 text-zinc-600 dark:text-zinc-400" />
                        )}
                        <span className="truncate font-medium">{folderName}</span>
                    </div>

                    <div
                        className="flex items-center opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <DropdownMenu>
                            <DropdownMenuTrigger
                                render={
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        aria-label={`Options for folder ${folderName}`}
                                        className="h-5 w-5 text-zinc-400 hover:text-zinc-100 hover:bg-zinc-850 rounded"
                                    >
                                        <MoreHorizontal className="h-3.5 w-3.5" />
                                    </Button>
                                }
                            />
                            <DropdownMenuContent
                                align="end"
                                className="w-40 p-1 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-800 dark:text-zinc-200 shadow-xl rounded-lg font-sans"
                            >
                                <DropdownMenuItem
                                    onClick={handleAddFile}
                                    className="cursor-pointer text-xs py-1.5 px-2.5 rounded text-zinc-700 dark:text-zinc-300 hover:text-zinc-950 dark:hover:text-zinc-100 focus:bg-zinc-100 dark:focus:bg-zinc-800 focus:text-zinc-950 dark:focus:text-zinc-100 flex items-center gap-2 transition-colors"
                                >
                                    <FilePlus className="h-3.5 w-3.5 text-zinc-500 dark:text-zinc-400" />
                                    <span>New File</span>
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                    onClick={handleAddFolder}
                                    className="cursor-pointer text-xs py-1.5 px-2.5 rounded text-zinc-700 dark:text-zinc-300 hover:text-zinc-950 dark:hover:text-zinc-100 focus:bg-zinc-100 dark:focus:bg-zinc-800 focus:text-zinc-950 dark:focus:text-zinc-100 flex items-center gap-2 transition-colors"
                                >
                                    <FolderPlus className="h-3.5 w-3.5 text-zinc-500 dark:text-zinc-400" />
                                    <span>New Folder</span>
                                </DropdownMenuItem>
                                <DropdownMenuSeparator className="my-1 bg-zinc-200 dark:bg-zinc-800" />
                                <DropdownMenuItem
                                    onClick={handleRename}
                                    className="cursor-pointer text-xs py-1.5 px-2.5 rounded text-zinc-700 dark:text-zinc-300 hover:text-zinc-950 dark:hover:text-zinc-100 focus:bg-zinc-100 dark:focus:bg-zinc-800 focus:text-zinc-950 dark:focus:text-zinc-100 flex items-center gap-2 transition-colors"
                                >
                                    <Edit3 className="h-3.5 w-3.5 text-zinc-500 dark:text-zinc-400" />
                                    <span>Rename</span>
                                </DropdownMenuItem>
                                <DropdownMenuSeparator className="my-1 bg-zinc-200 dark:bg-zinc-800" />
                                <DropdownMenuItem
                                    onClick={handleDelete}
                                    className="cursor-pointer text-xs py-1.5 px-2.5 rounded text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 focus:bg-red-50 dark:focus:bg-red-950/30 focus:text-red-700 dark:focus:text-red-300 flex items-center gap-2 transition-colors"
                                >
                                    <Trash2 className="h-3.5 w-3.5" />
                                    <span>Delete</span>
                                </DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </div>
                </div>

                {isOpen && (
                    <div className="relative">
                        {/* Vertical tree indentation guide line */}
                        <div
                            className="absolute top-0 bottom-0 w-px bg-zinc-300/80 dark:bg-zinc-800/60 pointer-events-none"
                            style={{ left: `${17 + level * 16}px` }}
                        />
                        <div className="flex flex-col w-full">
                            {folder.items.map((childItem) => {
                                const childKey =
                                    "folderName" in childItem
                                        ? `folder-${currentPath}/${childItem.folderName}`
                                        : `file-${currentPath}/${childItem.filename}.${childItem.fileExtension}`;

                                return (
                                    <TemplateNode
                                        key={childKey}
                                        item={childItem}
                                        onFileSelect={onFileSelect}
                                        selectedFile={selectedFile}
                                        level={level + 1}
                                        path={currentPath}
                                        onAddFile={onAddFile}
                                        onAddFolder={onAddFolder}
                                        onDeleteFile={onDeleteFile}
                                        onDeleteFolder={onDeleteFolder}
                                        onRenameFile={onRenameFile}
                                        onRenameFolder={onRenameFolder}
                                    />
                                );
                            })}
                        </div>
                    </div>
                )}

                <NewFileDialog
                    isOpen={isNewFileDialogOpen}
                    onClose={() => setIsNewFileDialogOpen(false)}
                    onCreateFile={handleCreateFile}
                />

                <NewFolderDialog
                    isOpen={isNewFolderDialogOpen}
                    onClose={() => setIsNewFolderDialogOpen(false)}
                    onCreateFolder={handleCreateFolder}
                />

                <RenameFolderDialog
                    isOpen={isRenameDialogOpen}
                    onClose={() => setIsRenameDialogOpen(false)}
                    onRename={handleRenameSubmit}
                    currentFolderName={folderName}
                />

                <DeleteDialog
                    isOpen={isDeleteDialogOpen}
                    setIsOpen={setIsDeleteDialogOpen}
                    onConfirm={confirmDelete}
                    title="Delete Folder"
                    description={`Are you sure you want to delete "${folderName}" and all its contents? This action cannot be undone.`}
                    itemName={folderName}
                    confirmLabel="Delete"
                    cancelLabel="Cancel"
                />
            </div>
        );
    }
}
