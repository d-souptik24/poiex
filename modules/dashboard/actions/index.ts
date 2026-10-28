"use server";

import { db } from "@/lib/db";
import { currentUser } from "@/modules/auth/actions";
import { revalidatePath } from "next/cache";
import type { Prisma } from "@prisma/client";

export const toggleStarMarked = async (
    playgroundId: string,
    isChecked: boolean
) => {
    const user = await currentUser();
    const userId = user?.id;
    if (!userId) {
        throw new Error("User Id is Required");
    }

    try {
        if (isChecked) {
            await db.starMark.create({
                data: {
                    userId,
                    playgroundId,
                    isMarked: isChecked,
                },
            });
        } else {
            await db.starMark.delete({
                where: {
                    userId_playgroundId: {
                        userId,
                        playgroundId: playgroundId,
                    },
                },
            });
        }

        revalidatePath("/dashboard");
        return { success: true, isMarked: isChecked };
    } catch (error) {
        console.error("Error updating problem:", error);
        return { success: false, error: "Failed to update problem" };
    }
};

export const getAllPlaygroundForUser = async () => {
    const user = await currentUser();

    if (!user?.id) return [];

    try {
        const playground = await db.playground.findMany({
            where: {
                userId: user.id,
            },
            include: {
                user: true,
                Starmark: {
                    where: {
                        userId: user.id,
                    },
                    select: {
                        isMarked: true,
                    },
                },
            },
        });

        return playground;
    } catch (error) {
        console.log(error);
        return [];
    }
};

export const createPlayground = async (data: {
    title: string;
    template: "REACT" | "NEXTJS" | "EXPRESS" | "VUE" | "HONO" | "ANGULAR";
    description?: string;
}) => {
    const user = await currentUser();

    if (!user?.id) return;

    const { template, title, description } = data;

    try {
        const playground = await db.playground.create({
            data: {
                title: title,
                description: description,
                template: template,
                userId: user.id,
            },
        });

        revalidatePath("/dashboard");
        return playground;
    } catch (error) {
        console.log(error);
    }
};

export const deleteProjectById = async (id: string) => {
    const user = await currentUser();
    if (!user?.id) {
        throw new Error("Unauthorized");
    }

    try {
        const result = await db.playground.deleteMany({
            where: {
                id,
                userId: user.id,
            },
        });

        if (result.count === 0) {
            throw new Error("Project not found or unauthorized");
        }

        revalidatePath("/dashboard");
    } catch (error) {
        console.error("Error deleting project:", error);
        throw error;
    }
};

export const editProjectById = async (
    id: string,
    data: { title: string; description: string }
) => {
    const user = await currentUser();
    if (!user?.id) {
        throw new Error("Unauthorized");
    }

    try {
        const result = await db.playground.updateMany({
            where: {
                id,
                userId: user.id,
            },
            data,
        });

        if (result.count === 0) {
            throw new Error("Project not found or unauthorized");
        }

        revalidatePath("/dashboard");
    } catch (error) {
        console.error("Error updating project:", error);
        throw error;
    }
};

export const duplicateProjectById = async (id: string) => {
    const user = await currentUser();
    if (!user?.id) {
        throw new Error("Unauthorized");
    }

    try {
        const originalPlayground = await db.playground.findFirst({
            where: {
                id,
                userId: user.id,
            },
            include: {
                templateFiles: {
                    select: {
                        content: true,
                    },
                },
            },
        });

        if (!originalPlayground) {
            throw new Error("Original playground not found");
        }

        const newPlayground = await db.playground.create({
            data: {
                title: `${originalPlayground.title} (Copy)`,
                description: originalPlayground.description,
                template: originalPlayground.template,
                userId: user.id,
            },
        });

        if (originalPlayground.templateFiles?.length > 0 && originalPlayground.templateFiles[0].content !== null) {
            await db.templateFile.create({
                data: {
                    playgroundId: newPlayground.id,
                    content: originalPlayground.templateFiles[0].content as Prisma.InputJsonValue,
                },
            });
        }

        revalidatePath("/dashboard");
    } catch (error) {
        console.error("Error duplicating project:", error);
        throw error;
    }
};