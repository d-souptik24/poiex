import Link from "next/link";
import Image from "next/image";
import UserButton from "../auth/components/user-button";
import { ThemeToggle } from "@/components/ui/theme-toggle";

export function Header() {
    return (
        <header className="sticky top-0 left-0 right-0 z-50 px-4">
            <div className="flex items-center justify-center w-full">
                <div
                    className={`
                    flex items-center justify-between
                    bg-[#f0f2f6]/95 dark:bg-[#161820]/95
                    shadow-[0_10px_25px_-5px_rgba(0,0,0,0.08),0_2px_6px_rgba(0,0,0,0.04)]
                    dark:shadow-[0_12px_32px_-4px_rgba(0,0,0,0.8),0_0_0_1px_rgba(255,255,255,0.08)]
                    backdrop-blur-md
                    border-x border-b 
                    border-zinc-300/90 dark:border-zinc-700/80
                    w-full max-w-5xl
                    rounded-b-[28px]
                    px-6 py-2.5
                    relative
                    transition-all duration-300 ease-in-out
                `}
                >
                    {/* Brand Lockup */}
                    <Link
                        href="/"
                        className="flex items-center gap-2.5 transition-opacity hover:opacity-90"
                    >
                        <Image
                            src="/logo.svg"
                            alt="PoiEx Logo"
                            height={34}
                            width={34}
                            className="size-[34px] object-contain"
                            priority
                        />
                        <span className="font-extrabold text-[20px] tracking-tight text-zinc-900 dark:text-zinc-100">
                            PoiEx
                        </span>
                    </Link>

                    {/* Right-side Controls */}
                    <div className="flex items-center gap-3">
                        <ThemeToggle />
                        <UserButton />
                    </div>
                </div>
            </div>
        </header>
    );
}
