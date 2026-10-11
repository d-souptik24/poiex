"use client";

import { useTheme } from "next-themes";
import { useSyncExternalStore } from "react";
import { Moon, Sun } from "lucide-react";

const emptySubscribe = () => () => {};

export function ThemeToggle() {
    const { setTheme, resolvedTheme } = useTheme();
    const mounted = useSyncExternalStore(emptySubscribe, () => true, () => false);

    if (!mounted) {
        return null;
    }

    return (
        <div
            className="cursor-pointer"
            onClick={() => {
                setTheme(resolvedTheme === "dark" ? "light" : "dark");
            }}
        >
            {resolvedTheme === "dark" ? (
                <Sun className="h-5 w-5 text-white" />
            ) : (
                <Moon className="h-5 w-5 text-black" />
            )}
        </div>
    );
}
