import { type NextRequest, NextResponse } from "next/server";
import { currentUser } from "@/modules/auth/actions";

// Max duration for autocomplete fallback cascade on Vercel
export const maxDuration = 30;

interface MonacopilotRequestBody {
  completionMetadata?: {
    textBeforeCursor?: string;
    textAfterCursor?: string;
    language?: string;
    filename?: string;
    cursorPosition?: { lineNumber: number; column: number };
  };
  // Legacy payload fallback
  fileContent?: string;
  cursorLine?: number;
  cursorColumn?: number;
  fileName?: string;
}

const rawOllamaUrl = process.env.OLLAMA_BASE_URL || "http://127.0.0.1:11434";
const OLLAMA_BASE_URL = rawOllamaUrl.replace("localhost", "127.0.0.1");
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || "qwen2.5-coder:1.5b-base";

/**
 * In-memory health cache for Ollama to prevent 1.2s timeout overhead on every keystroke
 * when local Ollama is not running. Employs 120s negative caching when offline.
 */
let ollamaHealthCache: { isOnline: boolean; checkedAt: number; ttl: number } | null = null;

async function isOllamaAvailable(): Promise<boolean> {
  const isProd = process.env.NODE_ENV === "production";
  const isLocalhost =
    OLLAMA_BASE_URL.includes("127.0.0.1") ||
    OLLAMA_BASE_URL.includes("localhost");

  // 0ms bypass in production when configured to localhost
  if (isProd && isLocalhost) {
    return false;
  }

  const now = Date.now();
  if (
    ollamaHealthCache &&
    now - ollamaHealthCache.checkedAt < ollamaHealthCache.ttl
  ) {
    return ollamaHealthCache.isOnline;
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 800);

    const headers: Record<string, string> = {};
    if (process.env.OLLAMA_API_KEY) {
      headers["Authorization"] = `Bearer ${process.env.OLLAMA_API_KEY}`;
    }

    const res = await fetch(`${OLLAMA_BASE_URL}/api/tags`, {
      headers,
      signal: controller.signal,
      cache: "no-store",
    });

    clearTimeout(timeoutId);
    const online = res.ok;
    ollamaHealthCache = {
      isOnline: online,
      checkedAt: now,
      ttl: online ? 30_000 : 120_000, // 30s when active, 2min backoff when offline
    };
    return online;
  } catch {
    ollamaHealthCache = {
      isOnline: false,
      checkedAt: now,
      ttl: 120_000, // 2min negative cache prevents hammering closed sockets
    };
    return false;
  }
}

/**
 * Server-side LRU completion cache: saves LLM tokens when developer backspaces
 * or repositions cursor around recently completed code blocks.
 */
interface CompletionCacheEntry {
  completion: string;
  createdAt: number;
}
const serverCompletionCache = new Map<string, CompletionCacheEntry>();
const SERVER_CACHE_TTL_MS = 60_000; // 60 seconds
const MAX_SERVER_CACHE_SIZE = 120;

function getCachedCompletion(key: string): string | null {
  const entry = serverCompletionCache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.createdAt > SERVER_CACHE_TTL_MS) {
    serverCompletionCache.delete(key);
    return null;
  }
  return entry.completion;
}

function setCachedCompletion(key: string, completion: string) {
  if (serverCompletionCache.size >= MAX_SERVER_CACHE_SIZE) {
    const oldestKey = serverCompletionCache.keys().next().value;
    if (oldestKey) serverCompletionCache.delete(oldestKey);
  }
  serverCompletionCache.set(key, { completion, createdAt: Date.now() });
}

/**
 * Build a Qwen2.5-Coder FIM prompt.
 */
function buildFIMPrompt(
  prefix: string,
  suffix: string,
  filename?: string
): string {
  const fileSep = filename ? `<|file_sep|>${filename}\n` : "";
  return `${fileSep}<|fim_prefix|>${prefix}<|fim_suffix|>${suffix}<|fim_middle|>`;
}

/**
 * Strip suffix overlap: if the completion ends with characters that already
 * begin the suffix (e.g. closing brackets, semicolons), trim the duplicate
 * tail to prevent doubled tokens like `}}` or `;;`.
 */
function deduplicateSuffixOverlap(
  completion: string,
  suffix: string
): string {
  if (!completion || !suffix) return completion;

  const maxCheck = Math.min(completion.length, suffix.length, 32);
  let overlapLen = 0;

  for (let len = 1; len <= maxCheck; len++) {
    const tail = completion.slice(-len);
    const head = suffix.slice(0, len);
    if (tail === head) {
      overlapLen = len;
    }
  }

  return overlapLen > 0 ? completion.slice(0, -overlapLen) : completion;
}

/** Tokens that must never leak into the final suggestion. */
const FIM_TOKENS = [
  "<|fim_prefix|>",
  "<|fim_suffix|>",
  "<|fim_middle|>",
  "<|endoftext|>",
  "<|file_sep|>",
  "<|repo_name|>",
];

const FIM_TOKEN_REGEX = new RegExp(
  FIM_TOKENS.map((t) => t.replace(/[|]/g, "\\|")).join("|"),
  "g"
);

/**
 * Clean Instruct-model output: strip markdown fences, comments, conversational
 * introductory labels, and deduplicate suffix overlaps.
 */
function cleanGhostTextCompletion(rawText: string, suffix: string): string {
  if (!rawText) return "";

  let cleaned = rawText;

  // Strip markdown code fences (```typescript, ```ts, ```, etc.)
  cleaned = cleaned.replace(/^```[\w-]*\n?/i, "");
  cleaned = cleaned.replace(/\n?```$/i, "");
  cleaned = cleaned.replace(/```/g, "");

  // Strip common conversational introductory phrases
  cleaned = cleaned.replace(
    /^(here is the code|completion|code|continuation):\s*/i,
    ""
  );

  // Strip any residual FIM tokens
  cleaned = cleaned.replace(FIM_TOKEN_REGEX, "");

  cleaned = cleaned.trimEnd();

  // Deduplicate overlap with suffix
  return deduplicateSuffixOverlap(cleaned, suffix);
}

export async function POST(request: NextRequest) {
  try {
    const user = await currentUser();
    if (!user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body: MonacopilotRequestBody = await request.json();

    let prefix = "";
    let suffix = "";
    let filename: string | undefined;

    if (body.completionMetadata) {
      prefix = body.completionMetadata.textBeforeCursor ?? "";
      suffix = body.completionMetadata.textAfterCursor ?? "";
      filename = body.completionMetadata.filename;
    } else if (typeof body.fileContent === "string") {
      const lines = body.fileContent.split("\n");
      const line = body.cursorLine ?? 0;
      const col = body.cursorColumn ?? 0;
      const currentLine = lines[line] || "";
      const beforeContext = lines
        .slice(Math.max(0, line - 10), line)
        .join("\n");
      const afterContext = lines
        .slice(line + 1, Math.min(lines.length, line + 11))
        .join("\n");

      prefix = beforeContext
        ? `${beforeContext}\n${currentLine.substring(0, col)}`
        : currentLine.substring(0, col);
      suffix = afterContext
        ? `${currentLine.substring(col)}\n${afterContext}`
        : currentLine.substring(col);
      filename = body.fileName;
    }

    // Guard against ReDoS and memory exhaustion on huge payloads (>250KB)
    if (prefix.length + suffix.length > 250_000) {
      return NextResponse.json(
        { error: "Payload exceeds maximum allowed size" },
        { status: 400 }
      );
    }

    // CWE-400: Sanitize filename to prevent control character/newline injection and cap length
    const sanitizedFilename =
      typeof filename === "string"
        ? filename.replace(/[\r\n\t]/g, "").slice(0, 120).trim() || undefined
        : undefined;

    // Skip AI generation if both prefix and suffix are empty
    if (!prefix.trim() && !suffix.trim()) {
      return NextResponse.json({ completion: null, suggestion: "" });
    }

    // Strict window slicing: clamp prefix to last 2,000 chars (~60 lines) and suffix to next 800 chars (~20 lines)
    // Prevents large files (1,000+ lines) from inflating prompt tokens and consuming free-tier TPM quota
    const windowedPrefix = prefix.length > 2000 ? prefix.slice(-2000) : prefix;
    const windowedSuffix = suffix.length > 800 ? suffix.slice(0, 800) : suffix;

    // Check server-side LRU cache before making network calls
    const cacheKey = `${sanitizedFilename || "code"}:${windowedPrefix.slice(-250)}>>>${windowedSuffix.slice(0, 60)}`;
    const cached = getCachedCompletion(cacheKey);
    if (cached !== null) {
      return NextResponse.json({
        completion: cached || null,
        suggestion: cached,
        cached: true,
      });
    }

    const suggestion = await generateAutocompleteCascade(
      windowedPrefix,
      windowedSuffix,
      sanitizedFilename,
      request.signal
    );

    if (suggestion) {
      setCachedCompletion(cacheKey, suggestion);
    }

    return NextResponse.json({
      completion: suggestion || null,
      suggestion, // backward compatibility
    });
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Internal server error";
    console.error("AI code completion error:", error);
    return NextResponse.json(
      { error: "Internal server error", message, completion: null },
      { status: 500 }
    );
  }
}

/**
 * Autocomplete Cascade:
 * 1. Local/Remote Ollama (`qwen2.5-coder:1.5b-base`, FIM prompt)
 * 2. Groq Cloud LPU: Primary `qwen/qwen3.8-27b` (reasoning_effort: "none") -> Secondary `openai/gpt-oss-20b` (reasoning_effort: "low")
 * 3. Google Gemini (`gemini-3.1-flash-lite` 500 RPD -> `gemini-3.5-flash-lite`, BLOCK_NONE)
 * 4. OpenRouter Free (`openrouter/free`, max_tokens: 200)
 */
async function generateAutocompleteCascade(
  prefix: string,
  suffix: string,
  filename?: string,
  clientSignal?: AbortSignal
): Promise<string> {
  // If client already aborted (user kept typing), short-circuit immediately
  if (clientSignal?.aborted) return "";

  // 1. Try Ollama if online
  const isOnline = await isOllamaAvailable();
  if (isOnline) {
    const ollamaResult = await generateFromOllama(
      prefix,
      suffix,
      filename,
      clientSignal
    );
    if (ollamaResult) return ollamaResult;
  }

  // 2. Fallback to Groq (primary: qwen/qwen3.8-27b, secondary: openai/gpt-oss-20b)
  const groqApiKey =
    process.env.GROQ_AUTOCOMPLETE_KEY?.trim() ||
    process.env.GROQ_API_KEY?.trim();
  if (groqApiKey) {
    const groqResult = await generateFromGroq(
      prefix,
      suffix,
      filename,
      clientSignal,
      groqApiKey
    );
    if (groqResult) return groqResult;
  }

  // 3. Fallback to Gemini (gemini-3.1-flash-lite, preserving chat 3.5 bucket)
  const geminiApiKey =
    process.env.GEMINI_AUTOCOMPLETE_KEY?.trim() ||
    process.env.GEMINI_API_KEY?.trim();
  if (geminiApiKey) {
    const geminiResult = await generateFromGemini(
      prefix,
      suffix,
      filename,
      clientSignal,
      geminiApiKey
    );
    if (geminiResult) return geminiResult;
  }

  // 4. Fallback to OpenRouter (openrouter/free)
  if (process.env.OPENROUTER_API_KEY?.trim()) {
    const openrouterResult = await generateFromOpenRouter(
      prefix,
      suffix,
      filename,
      clientSignal
    );
    if (openrouterResult) return openrouterResult;
  }

  return "";
}

/**
 * Provider 1: Local / Remote Ollama (Qwen2.5-Coder FIM)
 */
async function generateFromOllama(
  prefix: string,
  suffix: string,
  filename?: string,
  clientSignal?: AbortSignal
): Promise<string> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 2000);

    if (clientSignal) {
      clientSignal.addEventListener("abort", () => controller.abort(), {
        once: true,
      });
    }

    const prompt = buildFIMPrompt(prefix, suffix, filename);
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (process.env.OLLAMA_API_KEY) {
      headers["Authorization"] = `Bearer ${process.env.OLLAMA_API_KEY}`;
    }

    let response = await fetch(`${OLLAMA_BASE_URL}/api/generate`, {
      method: "POST",
      headers,
      signal: controller.signal,
      body: JSON.stringify({
        model: OLLAMA_MODEL,
        prompt,
        stream: false,
        keep_alive: "15m",
        options: {
          temperature: 0.1,
          top_p: 0.9,
          repeat_penalty: 1.1,
          num_predict: 40,
          stop: [...FIM_TOKENS, "\n\n"],
        },
      }),
    });

    if (!response.ok && response.status === 404) {
      const altModel = OLLAMA_MODEL.endsWith("-base")
        ? OLLAMA_MODEL.replace("-base", "")
        : `${OLLAMA_MODEL}-base`;

      try {
        const altResponse = await fetch(`${OLLAMA_BASE_URL}/api/generate`, {
          method: "POST",
          headers,
          signal: controller.signal,
          body: JSON.stringify({
            model: altModel,
            prompt,
            stream: false,
            keep_alive: "15m",
            options: {
              temperature: 0.1,
              top_p: 0.9,
              repeat_penalty: 1.1,
              num_predict: 40,
              stop: [...FIM_TOKENS, "\n\n"],
            },
          }),
        });
        if (altResponse.ok) {
          response = altResponse;
        }
      } catch {}
    }

    clearTimeout(timeoutId);

    if (!response.ok) {
      return "";
    }

    const data = await response.json();
    return cleanGhostTextCompletion(data.response || "", suffix);
  } catch {
    return "";
  }
}

/**
 * Provider 2: Groq Cloud LPU
 * Exclusively uses qwen/qwen3.8-27b (with reasoning_effort: "none", 450 tok/s) and
 * openai/gpt-oss-20b (with reasoning_effort: "low", 1,000 tok/s, max_tokens: 512)
 * for autocomplete so chat models remain completely isolated.
 */
async function generateFromGroq(
  prefix: string,
  suffix: string,
  filename?: string,
  clientSignal?: AbortSignal,
  apiKey?: string
): Promise<string> {
  const resolvedApiKey =
    apiKey ||
    process.env.GROQ_AUTOCOMPLETE_KEY?.trim() ||
    process.env.GROQ_API_KEY?.trim();
  if (!resolvedApiKey) return "";

  const models = ["qwen/qwen3.8-27b", "openai/gpt-oss-20b"];

  for (const model of models) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 2000);

      if (clientSignal) {
        clientSignal.addEventListener("abort", () => controller.abort(), {
          once: true,
        });
      }

      const isQwen = model.includes("qwen");
      const bodyPayload: Record<string, unknown> = {
        model,
        messages: [
          {
            role: "system",
            content:
              "You are an inline code autocompletion engine.\n" +
              "Given the code prefix and suffix around the cursor, output ONLY the exact code characters that belong at the cursor position.\n" +
              "Rules:\n" +
              "1. Output ONLY pure raw code. Do NOT include markdown code fences, backticks, comments, or explanations.\n" +
              "2. If no completion is appropriate, return an empty string.",
          },
          {
            role: "user",
            content: `File: ${filename || "code"}\n\n[CODE_BEFORE_CURSOR]\n${prefix}\n\n[CODE_AFTER_CURSOR]\n${suffix}\n\n[COMPLETION]`,
          },
        ],
        temperature: 0.1,
        // Qwen supports reasoning_effort: "none" which completely disables thinking tokens (prevents ghost text starvation)
        // For GPT-OSS, reasoning cannot be completely disabled, so we allocate 512 tokens with "low" effort
        max_tokens: isQwen ? 128 : 512,
        stop: ["\n\n", "```"],
        reasoning_effort: isQwen ? "none" : "low",
      };

      const response = await fetch(
        "https://api.groq.com/openai/v1/chat/completions",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${resolvedApiKey}`,
            "Content-Type": "application/json",
          },
          signal: controller.signal,
          body: JSON.stringify(bodyPayload),
        }
      );

      clearTimeout(timeoutId);

      if (!response.ok) {
        continue;
      }

      const data = await response.json();
      const rawContent: string = data.choices?.[0]?.message?.content || "";
      const cleaned = cleanGhostTextCompletion(rawContent, suffix);
      if (cleaned) return cleaned;
    } catch {
      continue;
    }
  }

  return "";
}

/**
 * Provider 3: Google Gemini
 * Uses dedicated gemini-3.1-flash-lite (independent 500 RPD bucket, active until May 2027)
 * with BLOCK_NONE, leaving gemini-3.5-flash-lite and gemini-3.8-flash for Chat without quota collision.
 */
async function generateFromGemini(
  prefix: string,
  suffix: string,
  filename?: string,
  clientSignal?: AbortSignal,
  apiKey?: string
): Promise<string> {
  const resolvedApiKey =
    apiKey ||
    process.env.GEMINI_AUTOCOMPLETE_KEY?.trim() ||
    process.env.GEMINI_API_KEY?.trim();
  if (!resolvedApiKey) return "";

  const models = [
    "gemini-3.1-flash-lite",
    "gemini-3.5-flash-lite",
  ];

  for (const model of models) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 2000);

      if (clientSignal) {
        clientSignal.addEventListener("abort", () => controller.abort(), {
          once: true,
        });
      }

      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-goog-api-key": resolvedApiKey,
          },
          signal: controller.signal,
          body: JSON.stringify({
            contents: [
              {
                parts: [
                  {
                    text: `You are an inline code autocompletion engine. Output ONLY raw code for the cursor position. No markdown, no commentary, no backticks.\nFile: ${filename || "code"}\n\n[BEFORE]\n${prefix}\n\n[AFTER]\n${suffix}\n\n[CONTINUATION]`,
                  },
                ],
              },
            ],
            generationConfig: {
              temperature: 0.1,
              maxOutputTokens: 200,
              stopSequences: ["\n\n", "```"],
            },
            safetySettings: [
              { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_NONE" },
              { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_NONE" },
              { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_NONE" },
              { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_NONE" },
            ],
          }),
        }
      );

      clearTimeout(timeoutId);

      if (!response.ok) {
        continue;
      }

      const data = await response.json();
      const candidateText: string =
        data.candidates?.[0]?.content?.parts?.[0]?.text || "";
      const cleaned = cleanGhostTextCompletion(candidateText, suffix);
      if (cleaned) return cleaned;
    } catch {
      continue;
    }
  }

  return "";
}

/**
 * Provider 4: OpenRouter Free
 */
async function generateFromOpenRouter(
  prefix: string,
  suffix: string,
  filename?: string,
  clientSignal?: AbortSignal
): Promise<string> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 2500);

    if (clientSignal) {
      clientSignal.addEventListener("abort", () => controller.abort(), {
        once: true,
      });
    }

    const response = await fetch(
      "https://openrouter.ai/api/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
          "Content-Type": "application/json",
        },
        signal: controller.signal,
        body: JSON.stringify({
          model: "openrouter/free",
          messages: [
            {
              role: "system",
              content:
                "You are an inline code autocompletion engine.\nOutput ONLY raw code for the cursor position. No markdown, no fences, no explanation.",
            },
            {
              role: "user",
              content: `File: ${filename || "code"}\n\n[CODE_BEFORE_CURSOR]\n${prefix}\n\n[CODE_AFTER_CURSOR]\n${suffix}\n\n[COMPLETION]`,
            },
          ],
          temperature: 0.1,
          max_tokens: 200,
          stop: ["\n\n", "```"],
        }),
      }
    );

    clearTimeout(timeoutId);

    if (!response.ok) {
      return "";
    }

    const data = await response.json();
    const rawContent: string = data.choices?.[0]?.message?.content || "";
    return cleanGhostTextCompletion(rawContent, suffix);
  } catch {
    return "";
  }
}
