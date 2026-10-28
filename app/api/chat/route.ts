//import { db } from "@/lib/db";
//import { error } from "console";
import { NextRequest, NextResponse } from "next/server";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

interface ChatRequest {
  message: string;
  history: ChatMessage[];
  model?: string;
}

const OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL || "http://localhost:11434";
const DEFAULT_CHAT_MODEL = process.env.OLLAMA_MODEL || "qwen2.5-coder:1.5b-base";

async function generateAIResponse(
  messages: ChatMessage[],
  model: string
): Promise<string> {
  const systemPrompt = `You are a helpful AI coding assistant. You help developers with:
- Code explanations and debugging
- Best practices and architecture advice  
- Writing clean, efficient code
- Troubleshooting errors
- Code reviews and optimizations

Always provide clear, practical answers. Use proper code formatting when showing examples.`;

  const fullMessages = [{ role: "system", content: systemPrompt }, ...messages];

  const prompt = fullMessages
    .map((msg) => `${msg.role}: ${msg.content}`)
    .join("\n\n");

  try {
    const response = await fetch(`${OLLAMA_BASE_URL}/api/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        prompt,
        stream: false,
        options: {
          temperature: 0.7,  // Controls randomness (0-1)
          num_predict: 1000, // Maximum response length
          top_p: 0.9, // controls diversity
        },
      }),
    });

    const data = await response.json();

    if (!data.response) {
      throw new Error("No response from AI model");
    }

    return data.response.trim();
  } catch (error) {
    console.error("AI generation error:", error);
    throw new Error("Failed to generate AI response");
  }
}

export async function POST(req: NextRequest) {
  try {
    const body: ChatRequest = await req.json();
    const { message, history = [], model = DEFAULT_CHAT_MODEL } = body;

    // Validate input
    if (!message || typeof message !== "string") {
      return NextResponse.json(
        { error: "Message is required and must be a string" },
        { status: 400 }
      );
    }

    // Validate history format
    const validHistory = Array.isArray(history)
      ? history.filter(
          (msg) =>
            msg &&
            typeof msg === "object" &&
            typeof msg.role === "string" &&
            typeof msg.content === "string" &&
            ["user", "assistant"].includes(msg.role)
        )
      : [];

    const messages: ChatMessage[] = [
      ...validHistory.slice(-10),
      { role: "user", content: message },
    ];

    //   Generate ai response
    const aiResponse = await generateAIResponse(messages, model);

    return NextResponse.json({
      response: aiResponse,
      model,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Chat API Error:", error);
    return NextResponse.json(
      {
        error: "Failed to generate AI response",
        details: error instanceof Error ? error.message : "Unknown error",
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}
