import { NextResponse } from "next/server";
import { currentUser } from "@/modules/auth/actions";

export interface AIModelOption {
    id: string;
    name: string;
    provider: "local" | "groq" | "gemini" | "openrouter";
    recommended?: boolean;
    isAvailable?: boolean;
}

const CURATED_MODELS: {
    id: string;
    name: string;
    provider: "local" | "groq" | "gemini" | "openrouter";
    recommended?: boolean;
}[] = [
    {
        id: "gemini-3.5-flash-lite",
        name: "Gemini 3.5 Flash-Lite",
        provider: "gemini",
        recommended: true,
    },
    {
        id: "openai/gpt-oss-120b",
        name: "GPT-OSS 120B",
        provider: "groq",
    },
    {
        id: "openrouter/free",
        name: "OpenRouter Auto",
        provider: "openrouter",
    },
    {
        id: "poiex3.0-uncensored",
        name: "PoiEx 3.0 Uncensored",
        provider: "local",
    },
];

interface OllamaHealthCache {
    isOnline: boolean;
    installedTags: Set<string>;
    checkedAt: number;
}

let ollamaCache: OllamaHealthCache | null = null;
const CACHE_TTL_MS = 30_000; // 30 seconds

export async function GET() {
    // Require an authenticated session — prevents leaking provider availability
    // info (which API keys are configured) to unauthenticated requests.
    const user = await currentUser();
    if (!user?.id) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const isProd = process.env.NODE_ENV === "production";
    const rawUrl = process.env.OLLAMA_BASE_URL || "http://127.0.0.1:11434";
    const baseUrl = rawUrl.replace("localhost", "127.0.0.1");
    const isLocalhost = baseUrl.includes("127.0.0.1") || baseUrl.includes("localhost");
    const shouldSkipOllama = isProd && isLocalhost;

    let isOllamaOnline = false;
    let installedTagSet = new Set<string>();

    const now = Date.now();
    if (shouldSkipOllama) {
        // Zero-lag in production when configured to localhost
        isOllamaOnline = false;
    } else if (ollamaCache && now - ollamaCache.checkedAt < CACHE_TTL_MS) {
        // Use cached status
        isOllamaOnline = ollamaCache.isOnline;
        installedTagSet = ollamaCache.installedTags;
    } else {
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 1000);

            const headers: Record<string, string> = {};
            if (process.env.OLLAMA_API_KEY) {
                headers["Authorization"] = `Bearer ${process.env.OLLAMA_API_KEY}`;
            }

            const res = await fetch(`${baseUrl}/api/tags`, {
                headers,
                signal: controller.signal,
                cache: "no-store",
            });

            clearTimeout(timeoutId);

            if (res.ok) {
                const data = await res.json();
                const rawModels: { name: string }[] = data.models || [];
                isOllamaOnline = true;

                for (const m of rawModels) {
                    const cleanName = m.name.replace(":latest", "");
                    installedTagSet.add(cleanName);
                }
            }
        } catch {
            isOllamaOnline = false;
        }

        ollamaCache = {
            isOnline: isOllamaOnline,
            installedTags: installedTagSet,
            checkedAt: now,
        };
    }

    const isGroqConfigured = Boolean(process.env.GROQ_API_KEY?.trim());
    const isGeminiConfigured = Boolean(process.env.GEMINI_API_KEY?.trim());
    const isOpenRouterConfigured = Boolean(process.env.OPENROUTER_API_KEY?.trim());

    const models: AIModelOption[] = CURATED_MODELS.map((curated) => {
        let isAvailable = false;

        if (curated.id === "poiex3.0-uncensored") {
            // Uncensored model is available whenever cloud AI keys (Gemini/Groq/OpenRouter) or local daemon are active
            isAvailable = isGeminiConfigured || isGroqConfigured || isOpenRouterConfigured || isOllamaOnline;
        } else if (curated.provider === "local") {
            const hasTag =
                installedTagSet.has(curated.id) ||
                installedTagSet.has(`${curated.id}:latest`) ||
                installedTagSet.size === 0; // If tags endpoint didn't list or returned empty, treat as available if daemon is online
            isAvailable = isOllamaOnline && hasTag;
        } else if (curated.provider === "groq") {
            isAvailable = isGroqConfigured;
        } else if (curated.provider === "gemini") {
            isAvailable = isGeminiConfigured;
        } else if (curated.provider === "openrouter") {
            isAvailable = isOpenRouterConfigured;
        }

        return {
            id: curated.id,
            name: curated.name,
            provider: curated.provider,
            recommended: curated.recommended,
            isAvailable,
        };
    });

    // Determine the best default active model
    let defaultModel = "gemini-3.5-flash-lite";
    if (isGeminiConfigured) {
        defaultModel = "gemini-3.5-flash-lite";
    } else if (isGroqConfigured) {
        defaultModel = "openai/gpt-oss-120b";
    } else if (isOpenRouterConfigured) {
        defaultModel = "openrouter/free";
    } else if (isOllamaOnline) {
        defaultModel = "poiex3.0-uncensored";
    }

    return NextResponse.json({
        isOllamaOnline,
        defaultModel,
        models,
    });
}
