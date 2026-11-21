"use server";

import { db } from "@/lib/db";
import { TemplateFolder } from "../lib/path-to-json";
import { currentUser } from "@/modules/auth/actions";





export const getPlaygroundById = async (id: string) => {
    const user = await currentUser();
    if (!user?.id) return null;

    try {
        const playground = await db.playground.findFirst({
            where: {
                id,
                userId: user.id,
            },
            select: {
                title: true,
                templateFiles: {
                    select: {
                        content: true,
                        updatedAt: true,
                    },
                },
            },
        });
        return playground;
    } catch (error) {
        console.log(error);
        return null;
    }
};

export const SaveUpdatedCode = async (
    playgroundId: string,
    data: TemplateFolder,
    expectedUpdatedAt?: Date | string | null
) => {
    const user = await currentUser();
    if (!user?.id) return null;

    try {
        const playground = await db.playground.findFirst({
            where: {
                id: playgroundId,
                userId: user.id,
            },
            select: { id: true },
        });

        if (!playground) {
            console.error(`Unauthorized or non-existent playground: ${playgroundId}`);
            return null;
        }

        // Optimistic concurrency verification
        if (expectedUpdatedAt) {
            const existingFile = await db.templateFile.findUnique({
                where: { playgroundId },
                select: { updatedAt: true },
            });

            if (existingFile?.updatedAt) {
                const existingTime = new Date(existingFile.updatedAt).getTime();
                const expectedTime = new Date(expectedUpdatedAt).getTime();
                if (existingTime > expectedTime) {
                    console.warn(
                        `Concurrency conflict on playground ${playgroundId}: DB is newer (${existingFile.updatedAt.toISOString()}) than expected (${new Date(expectedUpdatedAt).toISOString()})`
                    );
                    throw new Error("Concurrency conflict: This playground was modified in another session. Please reload before saving.");
                }
            }
        }

        const updatedPlayground = await db.templateFile.upsert({
            where: {
                playgroundId,
            },
            update: {
                content: JSON.stringify(data),
            },
            create: {
                playgroundId,
                content: JSON.stringify(data),
            },
        });

        return updatedPlayground;
    } catch (error) {
        if (error instanceof Error && error.message.includes("Concurrency conflict")) {
            throw error;
        }
        console.log("SaveUpdatedCode error:", error);
        return null;
    }
};
