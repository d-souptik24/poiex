"use server";

import { db } from "@/lib/db";
import { currentUser } from "@/modules/auth/actions";
import { revalidatePath } from "next/cache";
import type { Prisma } from "@prisma/client";
import { parseGitHubUrl, fetchGitHubRepoAsTemplate } from "../lib/github";
import { MAX_FREE_PROJECTS } from "../constants";

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
        console.error("Error updating favorite:", error);
        return { success: false, error: "Failed to update favorite" };
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
            orderBy: {
                updatedAt: "desc",
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

/**
 * Enforce Atlas M0 storage quota: limits free tier users to 15 concurrent playgrounds.
 * ADMIN and PREMIUM_USER accounts are exempt.
 */
export async function assertFreeTierProjectAllowance(userId: string, role?: string): Promise<void> {
    const isExempt = role === "ADMIN" || role === "PREMIUM_USER";
    if (isExempt) return;

    const count = await db.playground.count({
        where: { userId },
    });

    if (count >= MAX_FREE_PROJECTS) {
        throw new Error(
            `Project limit reached (${MAX_FREE_PROJECTS}/${MAX_FREE_PROJECTS}). Free accounts on Atlas M0 can maintain up to ${MAX_FREE_PROJECTS} projects. Please archive or delete an existing project before creating a new one.`
        );
    }
}

export const createPlayground = async (data: {
    title: string;
    template: "REACT" | "NEXTJS" | "EXPRESS" | "VUE" | "HONO" | "ANGULAR";
    description?: string;
}) => {
    const user = await currentUser();

    if (!user?.id) return;

    const { template, title, description } = data;

    try {
        await assertFreeTierProjectAllowance(user.id, user.role);

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
        console.error("Error creating playground:", error);
        throw error;
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

        await assertFreeTierProjectAllowance(user.id, user.role);

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
    if (!user?.id && !user?.email) {
        throw new Error("Unauthorized. Please sign in to import a repository.");
    }

    let userId = user.id;
    if (!userId && user.email) {
        const dbUser = await db.user.findUnique({
            where: { email: user.email },
            select: { id: true },
        });
        userId = dbUser?.id;
    }

    if (!userId) {
        throw new Error("User record not found");
    }

    await assertFreeTierProjectAllowance(userId, user.role);

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
                { userId, provider: { in: ["github", "GitHub"] } },
                ...(user.email ? [{ user: { email: user.email }, provider: { in: ["github", "GitHub"] } }] : []),
            ],
        },
        select: {
            access_token: true,
        },
    });

    // Use the user's own OAuth token only.
    // The server-level GITHUB_TOKEN is intentionally NOT used here — it would
    // allow importing private repos the user does not own.
    const token = githubAccount?.access_token ?? undefined;
    const targetBranch = branch?.trim() || parsed.branch;

    const { templateFolder, detectedTemplate, defaultTitle, description } =
        await fetchGitHubRepoAsTemplate(parsed.owner, parsed.repo, targetBranch, token);

    const playground = await db.playground.create({
        data: {
            title: title?.trim() || defaultTitle,
            description,
            template: detectedTemplate,
            userId,
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

    // SECURITY: Only use the user's own OAuth token.
    // Never fall back to the server-level GITHUB_TOKEN — that would leak the
    // server admin's private repositories to any authenticated (but unlinked) user.
    const token = githubAccount?.access_token ?? null;

    if (!token) {
        return {
            isConnected: false,
            linked: isLinked,
            repos: [],
            error: isLinked
                ? "GitHub token missing or expired. Please reconnect your GitHub account."
                : undefined,
        };
    }

    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 8000);
        let res: Response;
        try {
            res = await fetch(
                "https://api.github.com/user/repos?sort=updated&per_page=100&type=all",
                {
                    headers: {
                        Authorization: `Bearer ${token}`,
                        Accept: "application/vnd.github.v3+json",
                        "User-Agent": "PoiEx-IDE",
                    },
                    signal: controller.signal,
                    cache: "no-store",
                }
            );
        } finally {
            clearTimeout(timeoutId);
        }

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
    if (!user?.id && !user?.email) {
        return { hasGithub: false, hasGoogle: false };
    }

    let userId = user.id;
    if (!userId && user.email) {
        const dbUser = await db.user.findUnique({
            where: { email: user.email },
            select: { id: true },
        });
        userId = dbUser?.id;
    }

    const accounts = await db.account.findMany({
        where: {
            OR: [
                ...(userId ? [{ userId }] : []),
                ...(user.email ? [{ user: { email: user.email } }] : []),
            ],
        },
        select: { provider: true },
    });

    return {
        hasGithub: accounts.some((a) => a.provider.toLowerCase() === "github"),
        hasGoogle: accounts.some((a) => a.provider.toLowerCase() === "google"),
    };
};
