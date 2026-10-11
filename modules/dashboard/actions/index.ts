"use server";

import { currentUser } from "@/modules/auth/actions";
import { db } from "@/lib/db";

// ─── Types ────────────────────────────────────────────────────────────────────

type PlaygroundTemplate = "REACT" | "NEXTJS" | "EXPRESS" | "VUE" | "HONO" | "ANGULAR";

interface CreatePlaygroundInput {
    title: string;
    template: PlaygroundTemplate;
    description?: string;
}

interface EditPlaygroundInput {
    title: string;
    description: string;
}

// ─── Read ──────────────────────────────────────────────────────────────────────

export const getAllPlaygroundForUser = async () => {
    const user = await currentUser();

    try {
        const playground = await db.playground.findMany({
            where: {
                userId: user?.id,
            },
            include: {
                user: true,
                Starmark: true,
            },
            orderBy: {
                updatedAt: "desc",
            },
        });

        return playground;
    } catch (error) {
        console.log("error is", error);
        return [];
    }
};

// ─── Create ────────────────────────────────────────────────────────────────────

export const createPlayground = async (data: CreatePlaygroundInput) => {
    const user = await currentUser();

    if (!user?.id) return null;

    try {
        const playground = await db.playground.create({
            data: {
                title: data.title,
                template: data.template,
                description: data.description,
                userId: user.id,
            },
        });

        return playground;
    } catch (error) {
        console.log("createPlayground error:", error);
        return null;
    }
};

// ─── Update ────────────────────────────────────────────────────────────────────

export const editProjectById = async (
    id: string,
    data: EditPlaygroundInput
) => {
    const user = await currentUser();

    if (!user?.id) return;

    try {
        await db.playground.update({
            where: { id, userId: user.id },
            data: {
                title: data.title,
                description: data.description,
            },
        });
    } catch (error) {
        console.log("editProjectById error:", error);
        throw error;
    }
};

// ─── Delete ────────────────────────────────────────────────────────────────────

export const deleteProjectById = async (id: string) => {
    const user = await currentUser();

    if (!user?.id) return;

    try {
        await db.playground.delete({
            where: { id, userId: user.id },
        });
    } catch (error) {
        console.log("deleteProjectById error:", error);
        throw error;
    }
};

// ─── Duplicate ─────────────────────────────────────────────────────────────────

export const duplicateProjectById = async (id: string) => {
    const user = await currentUser();

    if (!user?.id) return;

    try {
        const original = await db.playground.findUnique({
            where: { id, userId: user.id },
        });

        if (!original) return;

        await db.playground.create({
            data: {
                title: `${original.title} (Copy)`,
                description: original.description,
                template: original.template,
                userId: user.id,
            },
        });
    } catch (error) {
        console.log("duplicateProjectById error:", error);
        throw error;
    }
};

// ─── Star / Favourite ──────────────────────────────────────────────────────────

export const toggleStarMarked = async (playgroundId: string, isMarked: boolean) => {
    const user = await currentUser();

    if (!user?.id) return { success: false, error: "Unauthenticated", isMarked: false };

    try {
        await db.starMark.upsert({
            where: {
                userId_playgroundId: {
                    userId: user.id,
                    playgroundId,
                },
            },
            update: { isMarked },
            create: {
                userId: user.id,
                playgroundId,
                isMarked,
            },
        });

        return { success: true, error: null, isMarked };
    } catch (error) {
        console.log("toggleStarMarked error:", error);
        return { success: false, error: "Failed to toggle", isMarked: !isMarked };
    }
};