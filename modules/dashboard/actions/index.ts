"use server";

import { db } from "@/lib/db";
import { currentUser } from "@/modules/auth/actions";
import { revalidatePath } from "next/cache";
import type { Prisma } from "@prisma/client";
import { parseGitHubUrl, fetchGitHubRepoAsTemplate } from "../lib/github";

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

export const importGithubRepo = async (data: {
    repoUrl: string;
    branch?: string;
    title?: string;
}) => {
    const user = await currentUser();
    if (!user?.id) {
        throw new Error("Unauthorized. Please sign in to import a repository.");
    }

    const { repoUrl, branch, title } = data;

    const parsed = parseGitHubUrl(repoUrl);
    if (!parsed) {
        throw new Error(
            "Invalid GitHub repository URL. Format should be 'owner/repo' or 'https://github.com/owner/repo'."
        );
    }

    // Check if the user has an OAuth access token for GitHub in Account
    const githubAccount = await db.account.findFirst({
        where: {
            OR: [
                ...(user.id ? [{ userId: user.id, provider: { in: ["github", "GitHub"] } }] : []),
                ...(user.email ? [{ user: { email: user.email }, provider: { in: ["github", "GitHub"] } }] : []),
            ],
        },
        select: {
            access_token: true,
        },
    });

    const token = githubAccount?.access_token || process.env.GITHUB_TOKEN;
    const targetBranch = branch?.trim() || parsed.branch;

    const { templateFolder, detectedTemplate, defaultTitle, description } =
        await fetchGitHubRepoAsTemplate(parsed.owner, parsed.repo, targetBranch, token);

    const playground = await db.playground.create({
        data: {
            title: title?.trim() || defaultTitle,
            description,
            template: detectedTemplate,
            userId: user.id,
        },
    });

    await db.templateFile.create({
        data: {
            playgroundId: playground.id,
            content: JSON.stringify(templateFolder) as unknown as Prisma.InputJsonValue,
        },
    });

    revalidatePath("/dashboard");
    return {
        id: playground.id,
        title: playground.title,
    };
};

export interface UserGitHubRepo {
    id: number;
    name: string;
    fullName: string;
    owner: string;
    description: string | null;
    isPrivate: boolean;
    isFork: boolean;
    stars: number;
    defaultBranch: string;
    language: string | null;
    updatedAt: string;
}

export interface GetUserReposResult {
    isConnected: boolean;
    linked?: boolean;
    repos: UserGitHubRepo[];
    error?: string;
}

export const getUserGithubRepos = async (): Promise<GetUserReposResult> => {
    const user = await currentUser();
    if (!user?.id && !user?.email) {
        return { isConnected: false, linked: false, repos: [], error: "Unauthorized" };
    }

    let userId = user.id;
    if (!userId && user.email) {
        const dbUser = await db.user.findUnique({
            where: { email: user.email },
            select: { id: true },
        });
        userId = dbUser?.id;
    }

    const githubAccount = await db.account.findFirst({
        where: {
            OR: [
                ...(userId ? [{ userId, provider: { in: ["github", "GitHub"] } }] : []),
                ...(user.email ? [{ user: { email: user.email }, provider: { in: ["github", "GitHub"] } }] : []),
            ],
        },
        select: {
            access_token: true,
        },
    });

    const isLinked = !!githubAccount;
    const token = githubAccount?.access_token || process.env.GITHUB_TOKEN;

    if (!token) {
        return {
            isConnected: false,
            linked: isLinked,
            repos: [],
            error: isLinked ? "GitHub token missing or expired. Please reconnect your account." : undefined,
        };
    }

    try {
        const res = await fetch(
            "https://api.github.com/user/repos?sort=updated&per_page=100&type=all",
            {
                headers: {
                    Authorization: `Bearer ${token}`,
                    Accept: "application/vnd.github.v3+json",
                    "User-Agent": "PoiEx-IDE",
                },
                cache: "no-store",
            }
        );

        if (!res.ok) {
            if (res.status === 401 || res.status === 403) {
                return {
                    isConnected: false,
                    linked: isLinked,
                    repos: [],
                    error: "GitHub token expired or unauthorized. Please reconnect your account.",
                };
            }
            return {
                isConnected: true,
                linked: isLinked,
                repos: [],
                error: `GitHub API error: ${res.statusText}`,
            };
        }

        const data = await res.json();
        if (!Array.isArray(data)) {
            return { isConnected: true, linked: isLinked, repos: [] };
        }

        interface RawGitHubRepo {
            id: number;
            name: string;
            full_name: string;
            owner?: { login?: string };
            description?: string | null;
            private?: boolean;
            fork?: boolean;
            stargazers_count?: number;
            default_branch?: string;
            language?: string | null;
            updated_at: string;
        }

        const repos: UserGitHubRepo[] = (data as RawGitHubRepo[]).map((item) => ({
            id: item.id,
            name: item.name,
            fullName: item.full_name,
            owner: item.owner?.login || "",
            description: item.description || null,
            isPrivate: Boolean(item.private),
            isFork: Boolean(item.fork),
            stars: item.stargazers_count || 0,
            defaultBranch: item.default_branch || "main",
            language: item.language || null,
            updatedAt: item.updated_at,
        }));

        return { isConnected: true, linked: true, repos };
    } catch (error) {
        console.error("Failed to fetch user GitHub repos:", error);
        return {
            isConnected: true,
            linked: isLinked,
            repos: [],
            error: "Failed to connect to GitHub API.",
        };
    }
};

export const getUserConnectedAccounts = async (): Promise<{
    hasGithub: boolean;
    hasGoogle: boolean;
}> => {
    const user = await currentUser();
    if (!user?.id) {
        return { hasGithub: false, hasGoogle: false };
    }

    const accounts = await db.account.findMany({
        where: { userId: user.id },
        select: { provider: true },
    });

    return {
        hasGithub: accounts.some((a) => a.provider === "github"),
        hasGoogle: accounts.some((a) => a.provider === "google"),
    };
};
