import { useState, useEffect, useCallback } from "react";
import { toast } from "sonner";

import type { TemplateFolder } from "../lib/path-to-json";
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
            if (typeof parsedContent === "string") {
                try {
                    parsedContent = JSON.parse(parsedContent);
                } catch (e) {
                    console.error("Error parsing stringified templateFiles:", e);
                }
            }
            if (typeof parsedContent === "string") {
                try {
                    parsedContent = JSON.parse(parsedContent);
                } catch {}
            }

            if (
                parsedContent &&
                typeof parsedContent === "object" &&
                ("items" in parsedContent || "folderName" in parsedContent)
            ) {
                setTemplateData(parsedContent as TemplateFolder);
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
