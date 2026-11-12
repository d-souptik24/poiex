"use server";

import { db } from "@/lib/db";
import { currentUser } from "@/modules/auth/actions";

export interface ChatSessionItem {
    id: string;
    title: string;
    playgroundId: string | null;
    createdAt: Date;
    updatedAt: Date;
    _count?: {
        messages: number;
    };
}

export interface ChatMessageRecord {
    id: string;
    sessionId: string | null;
    role: "user" | "assistant";
    content: string;
    type?: string | null;
    model?: string | null;
    tokens?: number | null;
    createdAt: Date;
}

/**
 * Fetch all chat sessions for the current authenticated user.
 * Optionally filtered by playgroundId if provided.
 */
export async function getChatSessions(playgroundId?: string): Promise<ChatSessionItem[]> {
    const user = await currentUser();
    if (!user?.id) {
        return [];
    }

    try {
        const whereClause: {
            userId: string;
            playgroundId?: string;
        } = { userId: user.id };

        if (playgroundId) {
            whereClause.playgroundId = playgroundId;
        }

        const sessions = await db.chatSession.findMany({
            where: whereClause,
            orderBy: {
                updatedAt: "desc",
            },
            select: {
                id: true,
                title: true,
                playgroundId: true,
                createdAt: true,
                updatedAt: true,
                _count: {
                    select: {
                        messages: true,
                    },
                },
            },
        });

        return sessions;
    } catch (error) {
        console.error("Failed to fetch chat sessions:", error);
        return [];
    }
}

/**
 * Fetch all messages for a specific session belonging to current user.
 */
export async function getChatSessionMessages(sessionId: string): Promise<ChatMessageRecord[]> {
    const user = await currentUser();
    if (!user?.id || !sessionId) {
        return [];
    }

    try {
        const session = await db.chatSession.findFirst({
            where: {
                id: sessionId,
                userId: user.id,
            },
            select: {
                id: true,
            },
        });

        if (!session) {
            return [];
        }

        const messages = await db.chatMessage.findMany({
            where: {
                sessionId,
            },
            orderBy: {
                createdAt: "asc",
            },
            select: {
                id: true,
                sessionId: true,
                role: true,
                content: true,
                type: true,
                model: true,
                tokens: true,
                createdAt: true,
            },
        });

        return messages.map((m) => ({
            ...m,
            role: m.role as "user" | "assistant",
        }));
    } catch (error) {
        console.error(`Failed to fetch messages for session ${sessionId}:`, error);
        return [];
    }
}

/**
 * Create a new chat session for current user.
 */
export async function createChatSession(
    title: string = "New Chat",
    playgroundId?: string
): Promise<ChatSessionItem | null> {
    const user = await currentUser();
    if (!user?.id) {
        throw new Error("Unauthorized");
    }

    try {
        const session = await db.chatSession.create({
            data: {
                title: title.trim() || "New Chat",
                userId: user.id,
                playgroundId: playgroundId || null,
            },
            select: {
                id: true,
                title: true,
                playgroundId: true,
                createdAt: true,
                updatedAt: true,
            },
        });

        return {
            ...session,
            _count: { messages: 0 },
        };
    } catch (error) {
        console.error("Failed to create chat session:", error);
        throw new Error("Failed to create chat session");
    }
}

/**
 * Rename an existing chat session.
 */
export async function renameChatSession(
    sessionId: string,
    newTitle: string
): Promise<{ success: boolean; title?: string; error?: string }> {
    const user = await currentUser();
    if (!user?.id) {
        return { success: false, error: "Unauthorized" };
    }

    const cleanTitle = newTitle.trim();
    if (!cleanTitle) {
        return { success: false, error: "Title cannot be empty" };
    }

    try {
        const session = await db.chatSession.findFirst({
            where: {
                id: sessionId,
                userId: user.id,
            },
        });

        if (!session) {
            return { success: false, error: "Session not found" };
        }

        const updated = await db.chatSession.update({
            where: { id: sessionId },
            data: {
                title: cleanTitle,
            },
            select: {
                title: true,
            },
        });

        return { success: true, title: updated.title };
    } catch (error) {
        console.error(`Failed to rename chat session ${sessionId}:`, error);
        return { success: false, error: "Failed to rename session" };
    }
}

/**
 * Delete a chat session and all its messages.
 */
export async function deleteChatSession(
    sessionId: string
): Promise<{ success: boolean; error?: string }> {
    const user = await currentUser();
    if (!user?.id) {
        return { success: false, error: "Unauthorized" };
    }

    try {
        const session = await db.chatSession.findFirst({
            where: {
                id: sessionId,
                userId: user.id,
            },
        });

        if (!session) {
            return { success: false, error: "Session not found" };
        }

        await db.chatSession.delete({
            where: { id: sessionId },
        });

        return { success: true };
    } catch (error) {
        console.error(`Failed to delete chat session ${sessionId}:`, error);
        return { success: false, error: "Failed to delete session" };
    }
}

