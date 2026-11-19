import { TemplateFile, TemplateFolder } from "./path-to-json";

export function findFilePath(
    file: TemplateFile,
    folder: TemplateFolder,
    pathSoFar: string[] = []
): string | null {
    if (!folder || !folder.items) return null;

    for (const item of folder.items) {
        if ("folderName" in item) {
            const res = findFilePath(file, item, [...pathSoFar, item.folderName]);
            if (res) return res;
        } else {
            if (
                item.filename === file.filename &&
                item.fileExtension === file.fileExtension
            ) {
                return [
                    ...pathSoFar,
                    item.filename + (item.fileExtension ? "." + item.fileExtension : ""),
                ].join("/");
            }
        }
    }
    return null;
}

/**
 * Generates a unique file ID based on file location in folder structure
 * @param file The template file
 * @param rootFolder The root template folder containing all files
 * @returns A unique file identifier including full path
 */
export const generateFileId = (file: TemplateFile, rootFolder?: TemplateFolder | null): string => {
    const extension = file.fileExtension?.trim();
    const extensionSuffix = extension ? `.${extension}` : "";
    const fallback = `${file.filename}${extensionSuffix}`;

    if (!rootFolder) return fallback;

    const path = findFilePath(file, rootFolder)?.replace(/^\/+/, "");
    return path || fallback;
};

/**
 * Finds a file in the template tree by its relative path or filename
 */
export function findFileByPath(
    targetPath: string,
    folder: TemplateFolder,
    pathPartsSoFar: string[] = []
): TemplateFile | null {
    if (!folder || !folder.items) return null;
    for (const item of folder.items) {
        if ("folderName" in item) {
            const res = findFileByPath(targetPath, item, [...pathPartsSoFar, item.folderName]);
            if (res) return res;
        } else {
            const fullPath = [
                ...pathPartsSoFar,
                item.filename + (item.fileExtension ? `.${item.fileExtension}` : ""),
            ].join("/");
            if (fullPath === targetPath || item.filename === targetPath) {
                return item;
            }
        }
    }
    return null;
}

/**
 * Finds the first code file in the project folder hierarchy (fallback entry file)
 */
export function findFirstFile(folder: TemplateFolder): TemplateFile | null {
    if (!folder || !folder.items) return null;
    for (const item of folder.items) {
        if (!("folderName" in item)) {
            if (item.filename === "package-lock" && item.fileExtension === "json") continue;
            return item;
        }
    }
    for (const item of folder.items) {
        if ("folderName" in item) {
            const res = findFirstFile(item);
            if (res) return res;
        }
    }
    return null;
}

/**
 * Deep clones templateFolder and updates file contents based on provided open files.
 */
export function updateTemplateTreeWithFiles<
    T extends { filename: string; fileExtension: string; content?: string }
>(rootFolder: TemplateFolder, files: T[]): TemplateFolder {
    const updated = JSON.parse(JSON.stringify(rootFolder)) as TemplateFolder;

    for (const file of files) {
        if (typeof file.content !== "string") continue;
        const filePath = findFilePath(file as TemplateFile, rootFolder);
        if (!filePath) continue;

        const parts = filePath.split("/");
        const filenameWithExt = parts.pop()!;
        let currentFolder = updated;

        let folderFound = true;
        for (const part of parts) {
            if (!part) continue;
            const nextFolder = currentFolder.items.find(
                (item): item is TemplateFolder =>
                    "folderName" in item && item.folderName === part
            );
            if (!nextFolder) {
                folderFound = false;
                break;
            }
            currentFolder = nextFolder;
        }

        if (!folderFound) continue;

        const lastDotIndex = filenameWithExt.lastIndexOf(".");
        const hasExtension = lastDotIndex > 0;
        const filename = hasExtension
            ? filenameWithExt.slice(0, lastDotIndex)
            : filenameWithExt;
        const fileExtension = hasExtension
            ? filenameWithExt.slice(lastDotIndex + 1)
            : "";

        const targetFileNode = currentFolder.items.find(
            (item): item is TemplateFile =>
                !("folderName" in item) &&
                item.filename === filename &&
                (item.fileExtension || "") === fileExtension
        );

        if (targetFileNode) {
            targetFileNode.content = file.content;
        }
    }

    return updated;
}
