import { useState, useEffect, useCallback } from "react";
import { toast } from "sonner";

import type { TemplateFolder, TemplateFile } from "../lib/path-to-json";
import { getPlaygroundById, SaveUpdatedCode } from "../actions";

interface PlaygroundData {
    id: string;
    title?: string;
    [key: string]: unknown;
}

interface UsePlaygroundReturn {
    playgroundData: PlaygroundData | null;
    templateData: TemplateFolder | null;
    isLoading: boolean;
    error: string | null;
    loadPlayground: () => Promise<void>;
    saveTemplateData: (data: TemplateFolder) => Promise<void>;
}

export const usePlayground = (id: string): UsePlaygroundReturn => {
    const [playgroundData, setPlaygroundData] = useState<PlaygroundData | null>(
        null
    );
    const [templateData, setTemplateData] = useState<TemplateFolder | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const loadPlayground = useCallback(async () => {
        if (!id) return;

        try {
            setIsLoading(true);
            setError(null);

            const data = await getPlaygroundById(id);

            // @ts-expect-error - Prisma playground query shape differs slightly from interface
            setPlaygroundData(data);
            const rawContent = data?.templateFiles?.[0]?.content;

            let parsedContent: unknown = rawContent;
            while (typeof parsedContent === "string") {
                try {
                    parsedContent = JSON.parse(parsedContent);
                } catch {
                    break;
                }
            }

            if (
                parsedContent &&
                typeof parsedContent === "object" &&
                ("items" in parsedContent || "folderName" in parsedContent)
            ) {
                const folder = parsedContent as TemplateFolder;

                let wasModified = false;
                // Auto-heal existing projects created before lockfile mounting
                const hasLockfile = folder.items?.some(
                    (item) => "filename" in item && item.filename === "package-lock" && item.fileExtension === "json"
                );

                if (!hasLockfile) {
                    try {
                        const res = await fetch(`/api/template/${id}`);
                        if (res.ok) {
                            const templateRes = await res.json();
                            const templateItems: TemplateFolder["items"] =
                                templateRes.templateJson?.items ||
                                (Array.isArray(templateRes.templateJson) ? templateRes.templateJson : []);

                            const lockItem = templateItems.find(
                                (item) => "filename" in item && item.filename === "package-lock" && item.fileExtension === "json"
                            );
                            if (lockItem) {
                                folder.items = [...(folder.items || []), lockItem];
                                wasModified = true;
                            }
                        }
                    } catch (e) {
                        console.warn("Could not backfill lockfile for existing project:", e);
                    }
                }

                // If package.json has obsolete legacy bloat (@netlify/plugin-nextjs), clean it up
                const pkgFile = folder.items?.find(
                    (item) => "filename" in item && item.filename === "package" && item.fileExtension === "json"
                ) as TemplateFile | undefined;
                if (pkgFile && typeof pkgFile.content === "string" && pkgFile.content.includes("@netlify/plugin-nextjs")) {
                    try {
                        const pkgObj = JSON.parse(pkgFile.content);
                        if (pkgObj.dependencies?.["@netlify/plugin-nextjs"]) {
                            delete pkgObj.dependencies["@netlify/plugin-nextjs"];
                            wasModified = true;
                        }
                        if (pkgObj.dependencies?.["@supabase/supabase-js"]) {
                            delete pkgObj.dependencies["@supabase/supabase-js"];
                            wasModified = true;
                        }
                        if (wasModified) {
                            pkgFile.content = JSON.stringify(pkgObj, null, 2);
                        }
                    } catch {}
                }

                if (wasModified) {
                    try {
                        await SaveUpdatedCode(id, folder);
                    } catch (err) {
                        console.warn("Failed to persist updated template data:", err);
                    }
                }

                setTemplateData(folder);
                return;
            }

            // load template from api if not in saved content
            const res = await fetch(`/api/template/${id}`);

            if (!res.ok) throw new Error(`Failed to load template: ${res.status}`);

            const templateRes = await res.json();

            if (templateRes.templateJson && Array.isArray(templateRes.templateJson)) {
                setTemplateData({
                    folderName: "Root",
                    items: templateRes.templateJson,
                });
            } else {
                setTemplateData(
                    templateRes.templateJson || {
                        folderName: "Root",
                        items: [],
                    }
                );
            }
        } catch (err) {
            console.error("Error loading playground:", err);
            setError("Failed to load playground data");
            toast.error("Failed to load playground data");
        } finally {
            setIsLoading(false);
        }
    }, [id]);

    const saveTemplateData = useCallback(async (data: TemplateFolder) => {
        try {
            await SaveUpdatedCode(id, data);
            setTemplateData(data);
            toast.success("Changes saved");
        } catch (err) {
            console.error("Error saving template data:", err);
            toast.error("Failed to save changes");
            throw err;
        }
    }, [id]);

    useEffect(() => {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        loadPlayground();
    }, [loadPlayground]);

    return {
        playgroundData,
        templateData,
        isLoading,
        error,
        loadPlayground,
        saveTemplateData,
    };
};
