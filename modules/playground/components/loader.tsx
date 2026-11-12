import React from "react";
import Image from "next/image";
import { cn } from "@/lib/utils";

interface LoadingStepProps {
    currentStep?: number;
    step?: number;
    label?: string;
    title?: string;
    description?: string;
    className?: string;
}

const LoadingStep: React.FC<LoadingStepProps> = ({
    label = "Loading project playground...",
    title,
    description,
    className,
}) => (
    <div
        className={cn(
            "flex flex-col items-center justify-center text-center p-8 max-w-sm w-full select-none font-sans animate-in fade-in duration-300",
            className
        )}
    >
        {/* Concentric Circular Brand Mark with Radial Spinner */}
        <div className="relative mb-5 flex items-center justify-center size-20">
            {/* Soft Ambient Red Aura */}
            <div className="absolute -inset-2 rounded-full bg-red-500/15 blur-xl animate-pulse" />

            {/* Mathematically Symmetrical Circular SVG Spinner */}
            <svg
                className="size-20 animate-spin text-[#E93F3F]"
                viewBox="0 0 80 80"
                fill="none"
                style={{ animationDuration: "1.4s" }}
            >
                {/* Background Ring Track */}
                <circle
                    cx="40"
                    cy="40"
                    r="34"
                    className="stroke-zinc-200 dark:stroke-zinc-800"
                    strokeWidth="2.5"
                />
                {/* Active Rotating Red Arc */}
                <circle
                    cx="40"
                    cy="40"
                    r="34"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeDasharray="50 160"
                    strokeLinecap="round"
                />
            </svg>

            {/* Concentric Brand Shield */}
            <div className="absolute inset-0 flex items-center justify-center">
                <div className="size-13 rounded-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-md flex items-center justify-center">
                    <Image
                        src="/logo.svg"
                        alt="PoiEx"
                        width={28}
                        height={28}
                        className="size-7 object-contain"
                        priority
                    />
                </div>
            </div>
        </div>

        {/* Title */}
        <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 tracking-tight">
            {title || label}
        </h3>

        {/* Description */}
        <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400 max-w-xs leading-relaxed">
            {description || "Preparing your editor, files, and runtime environment..."}
        </p>

        {/* Smooth Indeterminate Sliding Progress Bar */}
        <div className="mt-5 w-44 h-1 bg-zinc-200 dark:bg-zinc-800/80 rounded-full overflow-hidden">
            <div className="h-full w-1/3 bg-gradient-to-r from-transparent via-[#E93F3F] to-transparent rounded-full animate-indeterminate" />
        </div>
    </div>
);

export default LoadingStep;

