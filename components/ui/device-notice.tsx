"use client";

import * as React from "react";
import { Laptop, X } from "lucide-react";
import { ActionTooltip } from "@/components/ui/action-tooltip";
import { cn } from "@/lib/utils";

export const DEVICE_NOTICE_COOLDOWN_MS = 2 * 60 * 1000; // 2 minutes
export const DEVICE_NOTICE_ENTRANCE_DELAY_MS = 1800; // 1.8s entrance delay

function subscribeToMobileMediaQuery(callback: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  if (!window.matchMedia) {
    window.addEventListener("resize", callback);
    return () => window.removeEventListener("resize", callback);
  }
  const mediaQuery = window.matchMedia("(max-width: 1023px)");
  mediaQuery.addEventListener("change", callback);
  return () => mediaQuery.removeEventListener("change", callback);
}

function getMobileSnapshot(): boolean {
  if (typeof window === "undefined") return false;
  if (!window.matchMedia) return window.innerWidth < 1024;
  return window.matchMedia("(max-width: 1023px)").matches;
}

function getMobileServerSnapshot(): boolean {
  return false;
}

export interface DeviceNoticeProps {
  className?: string;
  delayMs?: number;
  cooldownMs?: number;
  scope?: string;
}

export function DeviceNotice({
  className,
  delayMs = DEVICE_NOTICE_ENTRANCE_DELAY_MS,
  cooldownMs = DEVICE_NOTICE_COOLDOWN_MS,
  scope,
}: DeviceNoticeProps) {
  const isMobileOrTablet = React.useSyncExternalStore(
    subscribeToMobileMediaQuery,
    getMobileSnapshot,
    getMobileServerSnapshot
  );

  const [isDismissed, setIsDismissed] = React.useState<boolean>(false);
  const [isOpen, setIsOpen] = React.useState<boolean>(false);

  // When scope changes, reset dismissed state so it appears on the new page/section
  const [prevScope, setPrevScope] = React.useState(scope);
  if (prevScope !== scope) {
    setPrevScope(scope);
    setIsDismissed(false);
    setIsOpen(false);
  }

  React.useEffect(() => {
    if (!isMobileOrTablet) {
      return;
    }

    if (isDismissed) {
      // 2-minute cooldown on the current page: after 2 minutes, un-dismiss so it reappears
      const cooldownTimer = setTimeout(() => {
        setIsDismissed(false);
      }, cooldownMs);

      return () => clearTimeout(cooldownTimer);
    }

    const entranceTimer = setTimeout(() => {
      setIsOpen(true);
    }, delayMs);

    return () => clearTimeout(entranceTimer);
  }, [isMobileOrTablet, isDismissed, delayMs, cooldownMs]);

  const handleDismiss = () => {
    setIsOpen(false);
    setTimeout(() => {
      setIsDismissed(true);
    }, 300);
  };

  if (!isMobileOrTablet || isDismissed) {
    return null;
  }

  return (
    <div
      className={cn(
        "absolute top-2 inset-x-3 sm:inset-x-auto sm:right-4 z-40 flex justify-center pointer-events-none transition-all duration-300 ease-out motion-reduce:transition-none",
        isOpen
          ? "translate-y-0 opacity-100 scale-100"
          : "-translate-y-3 opacity-0 scale-[0.98]",
        className
      )}
    >
      <aside
        role="status"
        aria-label="Device recommendation"
        className="pointer-events-auto relative w-full max-w-xl rounded-2xl bg-amber-50/95 dark:bg-[#181612]/95 backdrop-blur-xl border border-amber-300 dark:border-amber-500/30 p-3.5 shadow-xl shadow-zinc-950/8 dark:shadow-2xl dark:shadow-black/70 flex items-start sm:items-center justify-between gap-3 text-zinc-950 dark:text-zinc-100 transition-colors"
      >
        <div className="flex items-start sm:items-center gap-3 min-w-0 flex-1">
          <div className="size-8 rounded-xl bg-amber-500/15 dark:bg-amber-500/20 border border-amber-500/30 dark:border-amber-500/25 text-amber-700 dark:text-amber-400 flex items-center justify-center shrink-0 mt-0.5 sm:mt-0">
            <Laptop className="h-4 w-4" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 mb-0.5">
              <span className="font-semibold text-xs tracking-tight text-zinc-950 dark:text-zinc-100">
                Desktop Recommended
              </span>
            </div>
            <p className="text-[11.5px] leading-relaxed text-zinc-700 dark:text-zinc-400 break-words">
              Running Node.js inside a browser easily overloads mobile memory. For building and testing projects, we suggest switching to a laptop or desktop.
            </p>
          </div>
        </div>
        <ActionTooltip label="Dismiss notice">
          <button
            type="button"
            onClick={handleDismiss}
            aria-label="Dismiss notice"
            className="p-1.5 -mr-1 rounded-lg text-zinc-500 hover:text-zinc-900 dark:text-zinc-500 dark:hover:text-zinc-200 hover:bg-amber-200/40 dark:hover:bg-white/5 active:scale-95 transition-all shrink-0 mt-0.5 sm:mt-0 cursor-pointer min-h-[36px] min-w-[36px] flex items-center justify-center"
          >
            <X className="h-4 w-4" />
          </button>
        </ActionTooltip>
      </aside>
    </div>
  );
}
