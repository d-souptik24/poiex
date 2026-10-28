import { type NextRequest, NextResponse } from "next/server";
import { currentUser } from "@/modules/auth/actions";


interface CodeSuggestionRequest {
  fileContent: string;
  cursorLine: number;
  cursorColumn: number;
  suggestionType: string;
  fileName?: string;
}

interface CodeContext {
  language: string;
  framework: string;
  beforeContext: string;
  currentLine: string;
  afterContext: string;
  cursorPosition: { line: number; column: number };
  isInFunction: boolean;
  isInClass: boolean;
  isAfterComment: boolean;
  incompletePatterns: string[];
}

export async function POST(request: NextRequest) {
  try {
    const user = await currentUser();
    if (!user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body: CodeSuggestionRequest = await request.json();

    const { fileContent, cursorLine, cursorColumn, suggestionType, fileName } =
      body;

    // Validate input
    if (!fileContent || cursorLine < 0 || cursorColumn < 0 || !suggestionType) {
      return NextResponse.json(
        { error: "Invalid input parameters" },
        { status: 400 }
      );
    }

    // Guard against ReDoS and memory exhaustion on huge payloads (>250KB)
    if (fileContent.length > 250_000) {
      return NextResponse.json(
        { error: "Payload exceeds maximum allowed size" },
        { status: 400 }
      );
    }

    const context = analyzeCodeContext(
      fileContent,
      cursorLine,
      cursorColumn,
      fileName
    );

    // Skip AI generation only if there is no surrounding code context at all
    if (!context.beforeContext.trim() && !context.afterContext.trim() && !context.currentLine.trim()) {
      return NextResponse.json({
        suggestion: "",
        context,
        metadata: {
          language: context.language,
          framework: context.framework,
          position: context.cursorPosition,
          generatedAt: new Date().toISOString(),
        },
      });
    }


    const prompt = buildPrompt(context);

    const suggestion = await generateSuggestion(prompt, request.signal);

    return NextResponse.json({
      suggestion,
      context,
      metadata: {
        language: context.language,
        framework: context.framework,
        position: context.cursorPosition,
        generatedAt: new Date().toISOString(),
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Internal server error";
    console.error("Context analysis error:", error);
    return NextResponse.json(
      { error: "Internal server error", message },
      { status: 500 }
    );
  }
}

function analyzeCodeContext(
  content: string,
  line: number,
  column: number,
  fileName?: string
): CodeContext {
  const lines = content.split("\n");
  const currentLine = lines[line] || "";

  // Get surrounding context (10 lines before and after)
  const contextRadius = 10;
  const startLine = Math.max(0, line - contextRadius);
  const endLine = Math.min(lines.length, line + contextRadius);

  const beforeContext = lines.slice(startLine, line).join("\n");
  const afterContext = lines.slice(line + 1, endLine).join("\n");

  // Detect language and framework
  const language = detectLanguage(content, fileName);
  const framework = detectFramework(content);

  // Analyze code patterns
  const isInFunction = detectInFunction(lines, line);
  const isInClass = detectInClass(lines, line);
  const isAfterComment = detectAfterComment(currentLine, column);
  const incompletePatterns = detectIncompletePatterns(currentLine, column);

  return {
    language,
    framework,
    beforeContext,
    currentLine,
    afterContext,
    cursorPosition: { line, column },
    isInFunction,
    isInClass,
    isAfterComment,
    incompletePatterns,
  };
}

const OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL || "http://localhost:11434";
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || "qwen2.5-coder:1.5b-base";

function buildPrompt(context: CodeContext): string {
  const prefix = context.beforeContext
    ? `${context.beforeContext}\n${context.currentLine.substring(0, context.cursorPosition.column)}`
    : context.currentLine.substring(0, context.cursorPosition.column);

  const suffix = context.afterContext
    ? `${context.currentLine.substring(context.cursorPosition.column)}\n${context.afterContext}`
    : context.currentLine.substring(context.cursorPosition.column);

  // Qwen2.5-Coder native Fill-In-The-Middle (FIM) format
  return `<|fim_prefix|>${prefix}<|fim_suffix|>${suffix}<|fim_middle|>`;
}

async function generateSuggestion(prompt: string, clientSignal?: AbortSignal): Promise<string> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 4000); // 4-second timeout for responsive UX

    if (clientSignal) {
      if (clientSignal.aborted) {
        clearTimeout(timeoutId);
        return "";
      }
      clientSignal.addEventListener("abort", () => controller.abort(), { once: true });
    }

    const response = await fetch(`${OLLAMA_BASE_URL}/api/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: controller.signal,
      body: JSON.stringify({
        model: OLLAMA_MODEL,
        prompt,
        stream: false,
        keep_alive: "15m",
        options: {
          temperature: 0.2,
          top_p: 0.95,
          num_predict: 32, // Optimized for fast single-line completions on CPU
          stop: [
            "<|fim_prefix|>",
            "<|fim_suffix|>",
            "<|fim_middle|>",
            "<|endoftext|>",
            "<|file_separator|>",
            "\n\n\n",
          ],
        },
      }),
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      console.warn(`Ollama service returned status: ${response.status} ${response.statusText}`);
      return "";
    }

    const data = await response.json();
    let suggestion = data.response || "";

    // Strip any residual FIM tokens
    suggestion = suggestion
      .replace(/<\|fim_prefix\|>/g, "")
      .replace(/<\|fim_suffix\|>/g, "")
      .replace(/<\|fim_middle\|>/g, "")
      .replace(/<\|endoftext\|>/g, "")
      .replace(/<\|file_separator\|>/g, "");

    // If enclosed in markdown code fences, extract the raw code
    if (suggestion.includes("```")) {
      const codeMatch = suggestion.match(/```[\w]*\n?([\s\S]*?)```/);
      suggestion = codeMatch ? codeMatch[1] : suggestion;
    }

    return suggestion;
  } catch (error) {
    console.error("AI code completion error:", error);
    // Return empty string on error so editor ghost text is not polluted with error comments
    return "";
  }
}

// Helper functions for code analysis
function detectLanguage(content: string, fileName?: string): string {
  if (fileName) {
    const ext = fileName.split(".").pop()?.toLowerCase();
    const extMap: Record<string, string> = {
      ts: "TypeScript",
      tsx: "TypeScript",
      js: "JavaScript",
      jsx: "JavaScript",
      py: "Python",
      java: "Java",
      go: "Go",
      rs: "Rust",
      php: "PHP",
    };
    if (ext && extMap[ext]) return extMap[ext];
  }

  // Content-based detection
  if (content.includes("interface ") || content.includes(": string"))
    return "TypeScript";
  if (content.includes("def ") || content.includes("import ")) return "Python";
  if (content.includes("func ") || content.includes("package ")) return "Go";

  return "JavaScript";
}

function detectFramework(content: string): string {
  if (content.includes("import React") || content.includes("useState"))
    return "React";
  if (content.includes("import Vue") || content.includes("<template>"))
    return "Vue";
  if (content.includes("@angular/") || content.includes("@Component"))
    return "Angular";
  if (content.includes("next/") || content.includes("getServerSideProps"))
    return "Next.js";

  return "None";
}

function detectInFunction(lines: string[], currentLine: number): boolean {
  for (let i = currentLine - 1; i >= 0; i--) {
    const line = lines[i];
    if (line?.match(/^\s*(function|def|const\s+\w+\s*=|let\s+\w+\s*=)/))
      return true;
    if (line?.match(/^\s*}/)) break;
  }
  return false;
}

function detectInClass(lines: string[], currentLine: number): boolean {
  for (let i = currentLine - 1; i >= 0; i--) {
    const line = lines[i];
    if (line?.match(/^\s*(class|interface)\s+/)) return true;
  }
  return false;
}

function detectAfterComment(line: string, column: number): boolean {
  const beforeCursor = line.substring(0, column);
  return /\/\/.*$/.test(beforeCursor) || /#.*$/.test(beforeCursor);
}

function detectIncompletePatterns(line: string, column: number): string[] {
  const beforeCursor = line.substring(0, column);
  const patterns: string[] = [];

  if (/^\s*(if|while|for)\s*\($/.test(beforeCursor.trim()))
    patterns.push("conditional");
  if (/^\s*(function|def)\s*$/.test(beforeCursor.trim()))
    patterns.push("function");
  if (/\{\s*$/.test(beforeCursor)) patterns.push("object");
  if (/\[\s*$/.test(beforeCursor)) patterns.push("array");
  if (/=\s*$/.test(beforeCursor)) patterns.push("assignment");
  if (/\.\s*$/.test(beforeCursor)) patterns.push("method-call");

  return patterns;
}
