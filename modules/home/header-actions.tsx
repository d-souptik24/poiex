"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import UserButton from "@/modules/auth/components/user-button";
import { useCurrentUser } from "@/modules/auth/hooks/use-current-user";

export function HeaderActions() {
    const user = useCurrentUser();

    return (
        <div className="flex items-center gap-2.5">
            <div className="flex items-center justify-center size-8 rounded-full hover:bg-zinc-200/60 dark:hover:bg-zinc-800/60 transition-colors">
                <ThemeToggle />
            </div>

            {user ? (
                <UserButton />
            ) : (
                <Link href="/auth/sign-in">
                    <Button
                        variant="brand"
                        size="sm"
                        className="h-8 px-3.5 text-xs font-semibold tracking-tight rounded-full shadow-xs shadow-red-500/25 transition-all duration-150 active:scale-[0.98] border border-red-500/30"
                    >
                        Sign in
                    </Button>
                </Link>
            )}
        </div>
    );
}
