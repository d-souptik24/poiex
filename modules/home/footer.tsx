import Link from "next/link";
import { FaGithub } from "react-icons/fa";

export function Footer() {
    const socialLinks = [
        {
            name: "GitHub",
            href: "https://github.com/d-souptik24/poiex",
            icon: (
                <FaGithub className="size-5 text-muted-foreground hover:text-foreground transition-colors" />
            ),
        },
    ];

    return (
        <footer className="relative z-10 mt-auto border-t border-border">
            <div className="mx-auto max-w-7xl px-4 sm:px-6 py-6 flex flex-col items-center space-y-4 text-center">
                {/* Social Links */}
                <div className="flex gap-4">
                    {socialLinks.map((link) => (
                        <Link
                            key={link.name}
                            href={link.href}
                            target="_blank"
                            rel="noopener noreferrer"
                            aria-label={link.name}
                        >
                            {link.icon}
                        </Link>
                    ))}
                </div>

                {/* Copyright Notice */}
                <p className="text-xs sm:text-sm text-muted-foreground">
                    &copy; {new Date().getFullYear()} PoiEx. All rights reserved.
                </p>
            </div>
        </footer>
    );
}
