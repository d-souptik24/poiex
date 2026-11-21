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

        // Atomic optimistic concurrency control
        if (expectedUpdatedAt) {
            const expectedDate = new Date(expectedUpdatedAt);
            const updateResult = await db.templateFile.updateMany({
                where: {
                    playgroundId,
                    updatedAt: {
                        lte: expectedDate,
                    },
                },
                data: {
                    content: JSON.stringify(data),
                },
            });

            if (updateResult.count === 0) {
                const existingFile = await db.templateFile.findUnique({
                    where: { playgroundId },
                    select: { updatedAt: true },
                });

                if (existingFile) {
                    console.warn(
                        `Concurrency conflict on playground ${playgroundId}: DB is newer (${existingFile.updatedAt.toISOString()}) than expected (${expectedDate.toISOString()})`
                    );
                    throw new Error("Concurrency conflict: This playground was modified in another session. Please reload before saving.");
                }
            } else {
                return await db.templateFile.findUnique({
                    where: { playgroundId },
                });
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
