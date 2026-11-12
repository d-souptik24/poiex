import { db } from "@/lib/db";
import { currentUser } from "@/modules/auth/actions";
import { NextRequest, NextResponse } from "next/server";

interface IncomingChatMessage {
    role: "user" | "assistant";
    content: string;
}

interface ChatRequest {
    message: string;
    history?: IncomingChatMessage[];
    model?: string;
    stream?: boolean;
    mode?: "chat" | "review" | "fix" | "optimize";
    sessionId?: string;
    playgroundId?: string;
    activeFileName?: string;
    activeFileContent?: string;
}

const rawOllamaUrl = process.env.OLLAMA_BASE_URL || "http://127.0.0.1:11434";
const OLLAMA_BASE_URL = rawOllamaUrl.replace("localhost", "127.0.0.1");

function getSystemPrompt(
    mode?: string,
    activeFileName?: string,
    activeFileContent?: string
): string {
    let base = "";
    switch (mode) {
        case "review":
            base = `You are an expert senior code reviewer. Analyze the code thoroughly for:
1. Architectural soundness & design patterns
2. Performance bottlenecks & memory efficiency
3. Security vulnerabilities & edge cases
4. Code readability, idiomatic conventions & typing
Provide actionable recommendations with clear diffs or code snippets.`;
            break;
        case "fix":
            base = `You are a specialist in debugging and root-cause analysis.
1. Identify the exact root cause of the error or bug.
2. Provide the minimal, surgical fix.
3. Explain why the bug occurred and how to prevent similar regressions.`;
            break;
        case "optimize":
            base = `You are a performance optimization architect.
Analyze execution complexity (time & space O(n)), database/network roundtrips, and memory usage.
Provide optimized implementations with quantified trade-offs.`;
            break;
        default:
            base = `You are an expert AI software engineer and pair programmer inside the PoiEx Web IDE.
Provide concise, correct, production-grade answers. Use Markdown code blocks with appropriate language identifiers.`;
            break;
    }

    if (activeFileName) {
        base += `\n\n[Active File Context: ${activeFileName}]`;

        // 1. Dynamic File-Type & Framework Rules
        if (activeFileName.endsWith(".tsx") || activeFileName.endsWith(".jsx")) {
            base += `\n- Framework: React / Next.js component.
- Always provide valid React code with 'export default function ...'.
- Include '"use client";' at the very top if using React hooks (useState, useEffect) or client-side libraries.
- NEVER wrap component code in <html>, <body>, or <script> tags.
- Preserve or adapt existing third-party imports as needed.`;
        } else if (activeFileName.endsWith(".ts") || activeFileName.endsWith(".js")) {
            base += `\n- Language: TypeScript/JavaScript.
- Respect the existing framework, imports, and paradigms seen in [Current Content] (e.g. Hono, Express, Angular, or vanilla Node.js).
- Maintain existing export structures (named exports, default export, or route handlers).
- Do NOT inject React conventions (like '"use client"' or JSX tags) unless the file clearly uses React.`;
        } else if (activeFileName.endsWith(".html")) {
            base += `\n- Format: HTML document or template. Output valid HTML structure.`;
        } else if (activeFileName.endsWith(".css")) {
            base += `\n- Format: Stylesheet. Output clean, valid CSS rules.`;
        } else if (activeFileName.endsWith(".json")) {
            base += `\n- Format: JSON configuration. Output strictly valid JSON without trailing commas.`;
        } else {
            base += `\n- Maintain the syntax, conventions, and existing patterns of ${activeFileName}.`;
        }

        // 2. Full-File Completeness Rule (Prevents file truncation on Apply / Diff)
        base += `\n\n[CRITICAL EDITING RULE FOR ${activeFileName}]:
- The user can apply your generated code directly to their editor via the '[ Apply ]' and '[ Review Diff ]' buttons, which replace the ENTIRE file buffer.
- Therefore, when proposing updates or new implementations for ${activeFileName}, you MUST output the COMPLETE, fully runnable file from top to bottom inside a single Markdown code block.
- NEVER use partial snippets or placeholders like '// ... rest of code', '// ... keep existing imports', or '/* existing code */'.
- Retain all necessary existing imports, functions, and logic so that Diff comparison is clean and applying your code never deletes or corrupts unchanged portions of the file.`;

        // 3. Current Content Context
        if (activeFileContent && activeFileContent.trim()) {
            base += `\n\n[Current Content of ${activeFileName}]:\n\`\`\`\n${activeFileContent.slice(0, 10000)}\n\`\`\``;
        }
    }

    return base;
}

function generateTitleFromMessage(message: string): string {
    const cleaned = message.trim().replace(/^[`#*\s]+/, "");
    if (cleaned.length <= 36) return cleaned || "New Chat";
    return cleaned.slice(0, 36).trim() + "...";
}

function toGeminiContents(messages: { role: string; content: string }[]) {
    const contents: { role: "user" | "model"; parts: { text: string }[] }[] = [];
    for (const m of messages) {
        if (m.role === "system") continue;
        const role = m.role === "assistant" ? "model" : "user";
        if (contents.length > 0 && contents[contents.length - 1].role === role) {
            contents[contents.length - 1].parts[0].text += "\n\n" + m.content;
        } else {
            contents.push({ role, parts: [{ text: m.content }] });
        }
    }
    if (contents.length > 0 && contents[0].role === "model") {
        contents.shift();
    }
    return contents;
}

interface ProviderAttempt {
    provider: "local" | "groq" | "gemini" | "openrouter";
    modelId: string;
}

export async function POST(req: NextRequest) {
    try {
        const user = await currentUser();
        if (!user?.id) {
            return NextResponse.json(
                { error: "Unauthorized. Please sign in to use the AI Assistant." },
                { status: 401 }
            );
        }

        const userId: string = user.id;

        const body: ChatRequest = await req.json();
        const {
            message,
            history = [],
            model = "llama-3.3-70b-versatile",
            stream = false,
            mode = "chat",
            sessionId,
            playgroundId,
            activeFileName,
            activeFileContent,
        } = body;

        if (!message || typeof message !== "string" || !message.trim()) {
            return NextResponse.json(
                { error: "Message is required and must be a non-empty string." },
                { status: 400 }
            );
        }

        const validHistory = Array.isArray(history)
            ? history
                  .filter(
                      (msg) =>
                          msg &&
                          typeof msg === "object" &&
                          typeof msg.role === "string" &&
                          typeof msg.content === "string" &&
                          ["user", "assistant"].includes(msg.role)
                  )
                  .slice(-10)
            : [];

        // 1. Resolve or create ChatSession
        let activeSessionId = sessionId;
        let activeSessionTitle: string | undefined = undefined;

        try {
            if (activeSessionId) {
                const existingSession = await db.chatSession.findFirst({
                    where: { id: activeSessionId, userId },
                });

                if (existingSession) {
                    activeSessionTitle = existingSession.title;
                    if (existingSession.title === "New Chat") {
                        const newTitle = generateTitleFromMessage(message);
                        await db.chatSession.update({
                            where: { id: activeSessionId },
                            data: { title: newTitle, updatedAt: new Date() },
                        });
                        activeSessionTitle = newTitle;
                    } else {
                        await db.chatSession.update({
                            where: { id: activeSessionId },
                            data: { updatedAt: new Date() },
                        });
                    }
                } else {
                    activeSessionId = undefined;
                }
            }

            if (!activeSessionId) {
                const newTitle = generateTitleFromMessage(message);
                const createdSession = await db.chatSession.create({
                    data: {
                        title: newTitle,
                        userId,
                        playgroundId: playgroundId || null,
                    },
                });
                activeSessionId = createdSession.id;
                activeSessionTitle = createdSession.title;
            }

            // Save incoming user message
            await db.chatMessage.create({
                data: {
                    userId,
                    sessionId: activeSessionId,
                    role: "user",
                    content: message.trim(),
                    type: mode,
                    model,
                },
            });
        } catch (dbError) {
            console.error("Failed to persist user chat session/message:", dbError);
        }

        const systemPrompt = getSystemPrompt(mode, activeFileName, activeFileContent);
        const formattedMessages = [
            { role: "system", content: systemPrompt },
            ...validHistory.map((m) => ({ role: m.role, content: m.content })),
            { role: "user", content: message.trim() },
        ];

        const normalizedModel =
            model.startsWith("gemini")
                ? (model.startsWith("gemini-3") ? model : "gemini-3.5-flash-lite")
                : model;

        // 2. Build the Provider Attempt Queue based on user selection
        const attempts: ProviderAttempt[] = [];

        if (normalizedModel.startsWith("openai/") || normalizedModel.includes("gpt-oss") || normalizedModel.includes("groq") || normalizedModel.includes("llama")) {
            const actualModel = normalizedModel.includes("gpt-oss-20b")
                ? "openai/gpt-oss-20b"
                : "openai/gpt-oss-120b";
            attempts.push({ provider: "groq", modelId: actualModel });
            attempts.push({
                provider: "groq",
                modelId: actualModel === "openai/gpt-oss-120b" ? "openai/gpt-oss-20b" : "openai/gpt-oss-120b",
            });
            attempts.push({ provider: "gemini", modelId: "gemini-3.5-flash-lite" });
            attempts.push({ provider: "openrouter", modelId: "openrouter/free" });
        } else if (normalizedModel.startsWith("gemini")) {
            attempts.push({ provider: "gemini", modelId: normalizedModel });
            attempts.push({ provider: "groq", modelId: "openai/gpt-oss-120b" });
            attempts.push({ provider: "groq", modelId: "openai/gpt-oss-20b" });
            attempts.push({ provider: "openrouter", modelId: "openrouter/free" });
        } else if (normalizedModel.startsWith("openrouter")) {
            attempts.push({ provider: "openrouter", modelId: "openrouter/free" });
            attempts.push({ provider: "groq", modelId: "openai/gpt-oss-120b" });
            attempts.push({ provider: "gemini", modelId: "gemini-3.5-flash-lite" });
        } else {
            // Local / open-weight models (e.g. deepseek-coder)
            attempts.push({ provider: "local", modelId: normalizedModel });
            attempts.push({ provider: "groq", modelId: "openai/gpt-oss-120b" });
            attempts.push({ provider: "gemini", modelId: "gemini-3.5-flash-lite" });
            attempts.push({ provider: "openrouter", modelId: "openrouter/free" });
        }

        // 3. Connect to the first working provider
        let activeProvider: ProviderAttempt | null = null;
        let activeResponse: Response | null = null;

        for (const attempt of attempts) {
            try {
                if (attempt.provider === "local") {
                    const isProd = process.env.NODE_ENV === "production";
                    const isLocalhost =
                        OLLAMA_BASE_URL.includes("127.0.0.1") ||
                        OLLAMA_BASE_URL.includes("localhost");
                    if (isProd && isLocalhost) continue;

                    const headers: Record<string, string> = {
                        "Content-Type": "application/json",
                    };
                    if (process.env.OLLAMA_API_KEY) {
                        headers["Authorization"] = `Bearer ${process.env.OLLAMA_API_KEY}`;
                    }

                    const res = await fetch(`${OLLAMA_BASE_URL}/api/chat`, {
                        method: "POST",
                        headers,
                        signal: req.signal,
                        body: JSON.stringify({
                            model: attempt.modelId,
                            messages: formattedMessages,
                            stream: Boolean(stream),
                            options: {
                                temperature: 0.2,
                                num_predict: 2048,
                                top_p: 0.9,
                            },
                        }),
                    });

                    if (res.ok) {
                        activeProvider = attempt;
                        activeResponse = res;
                        break;
                    }
                } else if (attempt.provider === "groq") {
                    if (!process.env.GROQ_API_KEY?.trim()) continue;

                    const groqController = new AbortController();
                    const timeoutId = setTimeout(() => groqController.abort(), 4000);
                    if (req.signal) {
                        req.signal.addEventListener("abort", () => groqController.abort(), { once: true });
                    }

                    const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
                        method: "POST",
                        headers: {
                            Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
                            "Content-Type": "application/json",
                        },
                        signal: groqController.signal,
                        body: JSON.stringify({
                            model: attempt.modelId,
                            messages: formattedMessages,
                            stream: Boolean(stream),
                            temperature: 0.2,
                        }),
                    });

                    clearTimeout(timeoutId);

                    if (res.ok) {
                        activeProvider = attempt;
                        activeResponse = res;
                        break;
                    }
                } else if (attempt.provider === "gemini") {
                    const gemKey = process.env.GEMINI_API_KEY?.trim();
                    if (!gemKey) continue;

                    const requestedModel =
                        attempt.modelId.startsWith("gemini-3") || attempt.modelId === "gemini-3.5-flash-lite"
                            ? attempt.modelId
                            : "gemini-3.5-flash-lite";

                    const geminiModelsToTry = [
                        requestedModel,
                        "gemini-3.5-flash-lite",
                        "gemini-3.1-flash-lite",
                        "gemini-3-flash-preview",
                    ];

                    const uniqueGeminiModels = Array.from(new Set(geminiModelsToTry));
                    let geminiRes: Response | null = null;
                    const geminiContents = toGeminiContents(formattedMessages);

                    for (const gModel of uniqueGeminiModels) {
                        try {
                            const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${gModel}:${stream ? "streamGenerateContent?alt=sse" : "generateContent"}`;

                            const timeoutController = new AbortController();
                            const timeoutId = setTimeout(() => timeoutController.abort(), 4000);
                            if (req.signal) {
                                req.signal.addEventListener("abort", () => timeoutController.abort(), { once: true });
                            }

                            const gAttempt = await fetch(endpoint, {
                                method: "POST",
                                headers: {
                                    "Content-Type": "application/json",
                                    "x-goog-api-key": gemKey,
                                },
                                signal: timeoutController.signal,
                                body: JSON.stringify({
                                    systemInstruction: {
                                        parts: [{ text: systemPrompt }],
                                    },
                                    contents: geminiContents,
                                    generationConfig: {
                                        temperature: 0.2,
                                    },
                                }),
                            });

                            clearTimeout(timeoutId);

                            if (gAttempt.ok) {
                                geminiRes = gAttempt;
                                attempt.modelId = gModel;
                                break;
                            }
                        } catch {
                            continue;
                        }
                    }

                    if (geminiRes) {
                        activeProvider = attempt;
                        activeResponse = geminiRes;
                        break;
                    }
                } else if (attempt.provider === "openrouter") {
                    if (!process.env.OPENROUTER_API_KEY?.trim()) continue;

                    const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
                        method: "POST",
                        headers: {
                            Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
                            "Content-Type": "application/json",
                        },
                        signal: req.signal,
                        body: JSON.stringify({
                            model: attempt.modelId,
                            messages: formattedMessages,
                            stream: Boolean(stream),
                            temperature: 0.2,
                        }),
                    });

                    if (res.ok) {
                        activeProvider = attempt;
                        activeResponse = res;
                        break;
                    }
                }
            } catch (providerError) {
                console.warn(`Provider ${attempt.provider} (${attempt.modelId}) connection failed:`, providerError);
            }
        }

        if (!activeProvider || !activeResponse || !activeResponse.body) {
            const fallbackMsg =
                "Unable to connect to any AI provider. Please verify your internet connection or API keys.";

            if (activeSessionId) {
                await db.chatMessage
                    .create({
                        data: {
                            userId,
                            sessionId: activeSessionId,
                            role: "assistant",
                            content: fallbackMsg,
                            model,
                            type: "error",
                        },
                    })
                    .catch(() => {});
            }

            return NextResponse.json(
                {
                    error: fallbackMsg,
                    sessionId: activeSessionId,
                    sessionTitle: activeSessionTitle,
                },
                { status: 503 }
            );
        }

        const servingModel = activeProvider.modelId;
        const servingProvider = activeProvider.provider;

        // 4. Handle Streaming Response
        if (stream) {
            const encoder = new TextEncoder();
            const decoder = new TextDecoder();
            let accumulated = "";
            let lineBuffer = "";
            let isPersisted = false;

            const reader = activeResponse.body.getReader();

            const streamResponse = new ReadableStream({
                async start(controller) {
                    try {
                        while (true) {
                            const { done, value } = await reader.read();
                            if (done) break;

                            lineBuffer += decoder.decode(value, { stream: true });
                            const lines = lineBuffer.split("\n");
                            lineBuffer = lines.pop() || "";

                            for (const line of lines) {
                                const trimmed = line.trim();
                                if (!trimmed) continue;

                                let token = "";

                                if (servingProvider === "local") {
                                    try {
                                        const parsed = JSON.parse(trimmed);
                                        token = parsed.message?.content || "";
                                    } catch {}
                                } else if (servingProvider === "groq" || servingProvider === "openrouter") {
                                    if (trimmed.startsWith("data: ")) {
                                        const payload = trimmed.slice(6).trim();
                                        if (payload === "[DONE]") continue;
                                        try {
                                            const parsed = JSON.parse(payload);
                                            token = parsed.choices?.[0]?.delta?.content || "";
                                        } catch {}
                                    }
                                } else if (servingProvider === "gemini") {
                                    if (trimmed.startsWith("data: ")) {
                                        const payload = trimmed.slice(6).trim();
                                        try {
                                            const parsed = JSON.parse(payload);
                                            token = parsed.candidates?.[0]?.content?.parts?.[0]?.text || "";
                                        } catch {}
                                    }
                                }

                                if (token) {
                                    accumulated += token;
                                    controller.enqueue(
                                        encoder.encode(
                                            `data: ${JSON.stringify({
                                                token,
                                                model: servingModel,
                                                sessionId: activeSessionId,
                                            })}\n\n`
                                        )
                                    );
                                }
                            }
                        }

                        // Flush residual buffer
                        if (lineBuffer.trim()) {
                            let token = "";
                            const trimmed = lineBuffer.trim();
                            if (servingProvider === "local") {
                                try {
                                    const parsed = JSON.parse(trimmed);
                                    token = parsed.message?.content || "";
                                } catch {}
                            } else if (trimmed.startsWith("data: ")) {
                                const payload = trimmed.slice(6).trim();
                                if (payload !== "[DONE]") {
                                    try {
                                        const parsed = JSON.parse(payload);
                                        if (servingProvider === "gemini") {
                                            token = parsed.candidates?.[0]?.content?.parts?.[0]?.text || "";
                                        } else {
                                            token = parsed.choices?.[0]?.delta?.content || "";
                                        }
                                    } catch {}
                                }
                            }
                            if (token) {
                                accumulated += token;
                                controller.enqueue(
                                    encoder.encode(
                                        `data: ${JSON.stringify({
                                            token,
                                            model: servingModel,
                                            sessionId: activeSessionId,
                                        })}\n\n`
                                    )
                                );
                            }
                        }

                        // Send completion event
                        controller.enqueue(
                            encoder.encode(
                                `data: ${JSON.stringify({
                                    done: true,
                                    model: servingModel,
                                    sessionId: activeSessionId,
                                    sessionTitle: activeSessionTitle,
                                })}\n\n`
                            )
                        );

                        // Persist to MongoDB
                        if (!isPersisted && accumulated) {
                            isPersisted = true;
                            db.chatMessage
                                .create({
                                    data: {
                                        userId,
                                        sessionId: activeSessionId,
                                        role: "assistant",
                                        content: accumulated,
                                        model: servingModel,
                                        type: mode,
                                    },
                                })
                                .catch(() => {});

                            if (activeSessionId) {
                                db.chatSession
                                    .update({
                                        where: { id: activeSessionId },
                                        data: { updatedAt: new Date() },
                                    })
                                    .catch(() => {});
                            }
                        }

                        controller.close();
                    } catch (streamErr) {
                        controller.error(streamErr);
                    }
                },
            });

            return new Response(streamResponse, {
                headers: {
                    "Content-Type": "text/event-stream",
                    "Cache-Control": "no-cache",
                    Connection: "keep-alive",
                },
            });
        }

        // 5. Handle Non-Streaming JSON Response
        const data = await activeResponse.json();
        let reply = "No response received.";

        if (servingProvider === "local") {
            reply = data.message?.content || reply;
        } else if (servingProvider === "groq" || servingProvider === "openrouter") {
            reply = data.choices?.[0]?.message?.content || reply;
        } else if (servingProvider === "gemini") {
            reply = data.candidates?.[0]?.content?.parts?.[0]?.text || reply;
        }

        try {
            await db.chatMessage.create({
                data: {
                    userId,
                    sessionId: activeSessionId,
                    role: "assistant",
                    content: reply,
                    model: servingModel,
                    type: mode,
                },
            });

            if (activeSessionId) {
                await db.chatSession.update({
                    where: { id: activeSessionId },
                    data: { updatedAt: new Date() },
                });
            }
        } catch {}

        return NextResponse.json({
            response: reply,
            model: servingModel,
            sessionId: activeSessionId,
            sessionTitle: activeSessionTitle,
            timestamp: new Date().toISOString(),
        });
    } catch (error) {
        console.error("Chat API Error:", error);
        return NextResponse.json(
            {
                error: "Failed to generate AI response. Please try again.",
            },
            { status: 500 }
        );
    }
}
