import { NextResponse } from "next/server";
import { getUserGithubRepos } from "@/modules/dashboard/actions";

export async function GET() {
    try {
        const result = await getUserGithubRepos();
        return NextResponse.json({
            linked: result.isConnected,
            repos: result.repos,
            error: result.error,
        });
    } catch (error) {
        return NextResponse.json(
            {
                linked: false,
                repos: [],
                error: error instanceof Error ? error.message : "Failed to fetch repositories",
            },
            { status: 500 }
        );
    }
}
