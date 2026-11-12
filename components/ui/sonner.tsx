"use client";

import { useTheme } from "next-themes";
import { Toaster as Sonner } from "sonner";

type ToasterProps = React.ComponentProps<typeof Sonner>;

export function Toaster({ position = "bottom-center", ...props }: ToasterProps) {
  const { theme = "system" } = useTheme();

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      position={position}
      duration={2200}
      className="toaster group"
      toastOptions={{
        classNames: {
          toast:
            "group toast group-[.toaster]:bg-zinc-900/95 group-[.toaster]:dark:bg-zinc-950/95 group-[.toaster]:text-zinc-100 group-[.toaster]:dark:text-zinc-100 group-[.toaster]:border group-[.toaster]:border-zinc-800 group-[.toaster]:dark:border-zinc-800/80 group-[.toaster]:shadow-2xl group-[.toaster]:backdrop-blur-xl group-[.toaster]:rounded-xl font-sans text-xs py-2.5 px-4 tracking-tight",
          title: "font-medium text-xs text-zinc-100 dark:text-zinc-100",
          description: "text-[11px] text-zinc-400",
          actionButton:
            "group-[.toast]:bg-primary group-[.toast]:text-primary-foreground text-xs font-medium rounded-lg px-2.5 py-1",
          cancelButton:
            "group-[.toast]:bg-muted group-[.toast]:text-muted-foreground text-xs font-medium rounded-lg px-2.5 py-1",
          success:
            "[&_[data-icon]]:text-emerald-400 [&_[data-icon]>svg]:w-4 [&_[data-icon]>svg]:h-4",
          loading:
            "[&_[data-icon]]:text-[#E93F3F] [&_[data-icon]>svg]:w-4 [&_[data-icon]>svg]:h-4",
          error:
            "[&_[data-icon]]:text-rose-400 [&_[data-icon]>svg]:w-4 [&_[data-icon]>svg]:h-4",
          info:
            "[&_[data-icon]]:text-cyan-400 [&_[data-icon]>svg]:w-4 [&_[data-icon]>svg]:h-4",
          warning:
            "[&_[data-icon]]:text-amber-400 [&_[data-icon]>svg]:w-4 [&_[data-icon]>svg]:h-4",
        },
      }}
      {...props}
    />
  );
}
