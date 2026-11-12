import JSZip from "jszip";
import { Templates } from "@prisma/client";
import type { TemplateFolder, TemplateFile } from "@/modules/playground/lib/path-to-json";

const IGNORED_FOLDERS = new Set([
    "node_modules",
    ".git",
    ".github",
    ".vscode",
    ".idea",
    "dist",
    "build",
    "coverage",
    ".next",
    ".turbo",
    ".cache",
]);

const IGNORED_FILES = new Set([
    ".DS_Store",
    "thumbs.db",
    ".env.local",
    ".env.production",
    "package-lock.json",
    "yarn.lock",
    "pnpm-lock.yaml",
    "bun.lockb",
]);

const BINARY_EXTENSIONS = new Set([
    "png", "jpg", "jpeg", "gif", "ico", "webp", "avif",
    "woff", "woff2", "ttf", "eot", "otf",
    "mp4", "webm", "mp3", "wav",
    "zip", "tar", "gz", "rar", "7z",
    "pdf", "exe", "dll", "so", "dylib",
]);

const MAX_ARCHIVE_SIZE_BYTES = 25 * 1024 * 1024; // 25 MB
const MAX_FILE_SIZE_BYTES = 500 * 1024; // 500 KB per file
const MAX_TOTAL_SOURCE_BYTES = 12 * 1024 * 1024; // 12 MB total text (well under MongoDB 16MB document limit)

export interface ParsedGitHubUrl {
    owner: string;
    repo: string;
    branch?: string;
}

/**
 * Parses user input into GitHub owner, repo, and optional branch.
 * Supports:
 * - https://github.com/owner/repo
 * - https://github.com/owner/repo.git
 * - https://github.com/owner/repo/tree/branch-name
 * - github.com/owner/repo
 * - owner/repo
 */
export function parseGitHubUrl(input: string): ParsedGitHubUrl | null {
    if (!input || typeof input !== "string") return null;

    const trimmed = input.trim().replace(/\.git$/i, "");

    // Case 1: Full URL with branch: https://github.com/owner/repo/tree/branch
    const treeMatch = trimmed.match(
        /^(?:https?:\/\/)?github\.com\/([a-zA-Z0-9_.-]+)\/([a-zA-Z0-9_.-]+)\/tree\/(.+)$/i
    );
    if (treeMatch) {
        return {
            owner: treeMatch[1],
            repo: treeMatch[2],
            branch: treeMatch[3],
        };
    }

    // Case 2: Standard URL or domain-less shorthand
    const standardMatch = trimmed.match(
        /^(?:https?:\/\/)?(?:github\.com\/)?([a-zA-Z0-9_.-]+)\/([a-zA-Z0-9_.-]+)\/?$/i
    );
    if (standardMatch) {
        return {
            owner: standardMatch[1],
            repo: standardMatch[2],
        };
    }

    return null;
}

/**
 * Detects framework template based on package.json dependencies.
 */
function detectTemplateFromPackageJson(pkgJsonStr: string): Templates {
    try {
        const pkg = JSON.parse(pkgJsonStr);
        const deps = { ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}) };

        if (deps.next) return Templates.NEXTJS;
        if (deps.hono) return Templates.HONO;
        if (deps.express) return Templates.EXPRESS;
        if (deps.vue) return Templates.VUE;
        if (deps["@angular/core"]) return Templates.ANGULAR;
        return Templates.REACT;
    } catch {
        return Templates.REACT;
    }
}

/**
 * Traverses/builds nested folders in the virtual template tree and inserts a file.
 */
function insertFileIntoTree(
    root: TemplateFolder,
    pathSegments: string[],
    file: TemplateFile
): void {
    let currentFolder = root;

    for (let i = 0; i < pathSegments.length - 1; i++) {
        const folderName = pathSegments[i];
        let subFolder = currentFolder.items.find(
            (item): item is TemplateFolder => "folderName" in item && item.folderName === folderName
        );

        if (!subFolder) {
            subFolder = {
                folderName,
                items: [],
            };
            currentFolder.items.push(subFolder);
        }

        currentFolder = subFolder;
    }

    currentFolder.items.push(file);
}

export interface ImportedRepoResult {
    templateFolder: TemplateFolder;
    detectedTemplate: Templates;
    defaultTitle: string;
    description: string;
}

/**
 * Downloads a GitHub repo zipball in a single HTTP request, decompresses in memory,
 * filters out binaries and bloated directories, and constructs a PoiEx TemplateFolder tree.
 */
export async function fetchGitHubRepoAsTemplate(
    owner: string,
    repo: string,
    branch?: string,
    token?: string
): Promise<ImportedRepoResult> {
    const cleanBranch = branch?.trim() || "";
    const url = cleanBranch
        ? `https://api.github.com/repos/${owner}/${repo}/zipball/${encodeURIComponent(cleanBranch)}`
        : `https://api.github.com/repos/${owner}/${repo}/zipball`;

    const headers: Record<string, string> = {
        "User-Agent": "PoiEx-IDE",
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
    };

    if (token) {
        headers["Authorization"] = `Bearer ${token}`;
    }

    // Use standard redirect: "follow" so fetch authenticates with api.github.com
    // and naturally drops Authorization when following 302 to codeload.github.com
    let res = await fetch(url, {
        headers,
        redirect: "follow",
    });

    const codeloadUrl = cleanBranch
        ? `https://codeload.github.com/${owner}/${repo}/zip/refs/heads/${encodeURIComponent(cleanBranch)}`
        : `https://codeload.github.com/${owner}/${repo}/zip/HEAD`;

    // Fallback: If authenticated fetch returns 401 or 403 (e.g. expired or invalid database OAuth token),
    // immediately retry without Authorization header so public repositories download on the first try.
    if ((res.status === 401 || res.status === 403) && token) {
        const publicHeaders: Record<string, string> = {
            "User-Agent": "PoiEx-IDE",
            Accept: "application/vnd.github+json",
            "X-GitHub-Api-Version": "2022-11-28",
        };

        const publicRes = await fetch(url, {
            headers: publicHeaders,
            redirect: "follow",
        });

        if (publicRes.ok) {
            res = publicRes;
        } else {
            // Secondary direct fallback for public repos on codeload using HEAD when branch is omitted
            const codeloadRes = await fetch(codeloadUrl, {
                headers: publicHeaders,
                redirect: "follow",
            });
            if (codeloadRes.ok) {
                res = codeloadRes;
            }
        }
    } else if (!res.ok) {
        // Direct codeload fallback if unauthenticated rate limit or error on api.github.com
        try {
            const codeloadRes = await fetch(codeloadUrl, {
                headers: { "User-Agent": "PoiEx-IDE" },
                redirect: "follow",
            });
            if (codeloadRes.ok) {
                res = codeloadRes;
            }
        } catch {}
    }

    if (res.status === 404) {
        throw new Error(
            `Repository '${owner}/${repo}' (or branch '${cleanBranch || "default"}') was not found. Please verify the URL and ensure the repository is public or your account has access.`
        );
    }

    if (res.status === 401 || res.status === 403) {
        const rateLimitRemaining = res.headers.get("x-ratelimit-remaining");
        if (rateLimitRemaining === "0") {
            throw new Error(
                "GitHub API rate limit reached. Please wait a few minutes or re-connect your GitHub account."
            );
        }
        throw new Error(
            "Access to this GitHub repository was denied. Make sure you have permission to view it or re-link your GitHub account."
        );
    }

    if (!res.ok) {
        throw new Error(`GitHub responded with status ${res.status}: ${res.statusText}`);
    }

    const contentLength = res.headers.get("content-length");
    if (contentLength && parseInt(contentLength, 10) > MAX_ARCHIVE_SIZE_BYTES) {
        throw new Error(
            `Repository archive exceeds the 25MB limit (size: ${(
                parseInt(contentLength, 10) /
                (1024 * 1024)
            ).toFixed(1)}MB). WebContainers cannot boot repositories larger than 25MB.`
        );
    }

    const arrayBuffer = await res.arrayBuffer();
    const zip = await JSZip.loadAsync(arrayBuffer);

    const root: TemplateFolder = {
        folderName: "Root",
        items: [],
    };

    let totalSizeBytes = 0;
    let packageJsonContent: string | null = null;

    // Collect all valid file entries from the zip
    const entries: { relativePath: string; entry: JSZip.JSZipObject }[] = [];

    zip.forEach((path, entry) => {
        if (entry.dir) return;

        // GitHub zip entries start with a top-level folder: "<owner>-<repo>-<sha>/"
        const segments = path.split("/").filter(Boolean);
        if (segments.length <= 1) return; // Skip the top-level container directory itself

        // Drop the top-level GitHub folder
        const relativeSegments = segments.slice(1);

        // Check if any directory segment is in the ignore list
        const isIgnoredFolder = relativeSegments
            .slice(0, -1)
            .some((folder) => IGNORED_FOLDERS.has(folder));
        if (isIgnoredFolder) return;

        const filenameWithExt = relativeSegments[relativeSegments.length - 1];
        if (IGNORED_FILES.has(filenameWithExt)) return;

        // Skip binary file extensions
        const extMatch = filenameWithExt.match(/\.([^.]+)$/);
        const ext = extMatch ? extMatch[1].toLowerCase() : "";
        if (BINARY_EXTENSIONS.has(ext)) return;

        entries.push({
            relativePath: relativeSegments.join("/"),
            entry,
        });
    });

    if (entries.length === 0) {
        throw new Error("No readable source files were found in the specified repository.");
    }

    // Process file entries
    for (const { relativePath, entry } of entries) {
        const segments = relativePath.split("/");
        const fullFileName = segments[segments.length - 1];

        // Parse filename and extension
        const dotIndex = fullFileName.lastIndexOf(".");
        let filename: string;
        let fileExtension: string;

        if (dotIndex > 0) {
            filename = fullFileName.substring(0, dotIndex);
            fileExtension = fullFileName.substring(dotIndex + 1);
        } else {
            filename = fullFileName;
            fileExtension = "";
        }

        let content = "";
        try {
            content = await entry.async("string");
        } catch {
            continue;
        }

        if (content.length > MAX_FILE_SIZE_BYTES) {
            content = `// [File omitted: Size (${(content.length / 1024).toFixed(
                1
            )}KB) exceeds 500KB in-browser editor limit]`;
        }

        totalSizeBytes += content.length;
        if (totalSizeBytes > MAX_TOTAL_SOURCE_BYTES) {
            throw new Error(
                "Repository source files exceed the 12MB limit for in-browser editing. Consider importing a smaller project or branch."
            );
        }

        if (relativePath === "package.json") {
            packageJsonContent = content;
        }

        insertFileIntoTree(root, segments, {
            filename,
            fileExtension,
            content,
        });
    }

    if (!packageJsonContent) {
        throw new Error(
            "No package.json file was found at the root of the repository. WebContainers require a Node.js project with package.json to execute."
        );
    }

    const detectedTemplate = detectTemplateFromPackageJson(packageJsonContent);

    let defaultTitle = repo;
    let description = `Imported from https://github.com/${owner}/${repo}`;

    try {
        const pkg = JSON.parse(packageJsonContent);
        if (pkg.name && typeof pkg.name === "string") {
            defaultTitle = pkg.name;
        }
        if (pkg.description && typeof pkg.description === "string") {
            description = pkg.description;
        }
    } catch {
        // Fall back to repo name and URL
    }

    return {
        templateFolder: root,
        detectedTemplate,
        defaultTitle,
        description,
    };
}
