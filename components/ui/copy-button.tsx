"use client";

import * as React from "react";
import { Copy, Check } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

export interface CopyButtonProps
  extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "value"> {
  value: string | (() => string | Promise<string>);
  label?: string;
  copiedLabel?: string;
  iconClassName?: string;
  onCopy?: () => void;
}

export function CopyButton({
  value,
  label = "Copy",
  copiedLabel = "Copied!",
  className,
  iconClassName,
  onCopy,
  onClick,
  ...props
}: CopyButtonProps) {
  const [copied, setCopied] = React.useState(false);
  const timeoutRef = React.useRef<NodeJS.Timeout | null>(null);

  React.useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  const handleCopy = async (e: React.MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    onClick?.(e);
    if (e.defaultPrevented) return;

    try {
      const textToCopy = typeof value === "function" ? await value() : value;
      if (!textToCopy) return;

      await navigator.clipboard.writeText(textToCopy);
      setCopied(true);
      onCopy?.();
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      timeoutRef.current = setTimeout(() => {
        setCopied(false);
      }, 2000);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  };

  const Icon = copied ? Check : Copy;

  return (
    <Tooltip>
      <TooltipTrigger
        type="button"
        aria-label={copied ? copiedLabel : label}
        onClick={handleCopy}
        closeOnClick={false}
        className={cn(
          "inline-flex items-center justify-center p-1.5 rounded-md text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100 hover:bg-zinc-200/70 dark:hover:bg-zinc-800 transition-colors focus-visible:outline-hidden active:scale-95",
          className
        )}
        {...props}
      >
        <Icon
          className={cn(
            "size-3.5 transition-transform duration-150 scale-100 text-zinc-600 dark:text-zinc-300",
            iconClassName
          )}
        />
      </TooltipTrigger>
      <TooltipContent side="top">
        {copied ? copiedLabel : label}
      </TooltipContent>
    </Tooltip>
  );
}
