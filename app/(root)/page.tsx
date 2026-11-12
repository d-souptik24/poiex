import { Button } from "@/components/ui/button";
import { ArrowUpRight, FileCode, Bot, Copy, RotateCcw, FolderOpen } from "lucide-react";
import { FaGithub } from "react-icons/fa";
import Image from "next/image";
import Link from "next/link";

export default function Home() {
  return (
    <div className="flex-1 flex flex-col items-center justify-center max-w-5xl mx-auto px-4 sm:px-6 py-8 sm:py-12 text-center">
      {/* 1. Hero SVG Illustration with Ambient Radial Glow */}
      <div className="relative flex justify-center items-center mb-1">
        <div className="absolute size-48 sm:size-60 bg-red-500/10 dark:bg-red-500/15 rounded-full blur-3xl pointer-events-none" />
        <Image
          src="/hero.svg"
          alt="PoiEx Code Editor Hero"
          height={280}
          width={280}
          priority
          className="relative z-10 w-auto max-h-[190px] sm:max-h-[230px] object-contain drop-shadow-sm select-none"
        />
      </div>

      {/* 2. Intro: Headline & Subtext */}
      <div className="flex flex-col justify-center items-center mt-3">
        <h1 className="text-4xl sm:text-5xl md:text-6xl font-extrabold text-center bg-clip-text text-transparent bg-gradient-to-r from-rose-500 via-red-500 to-pink-500 dark:from-rose-400 dark:via-red-400 dark:to-pink-400 tracking-tight leading-tight">
          Write Code with Intelligence
        </h1>
      </div>

      <p className="mt-4 text-base sm:text-lg text-center text-muted-foreground px-4 max-w-2xl leading-relaxed">
        PoiEx is a powerful in-browser code editor that enhances your coding experience with native WebAssembly execution and private local AI. Designed to help you write, debug, and run full-stack projects seamlessly—with zero setup and zero cloud costs.
      </p>

      {/* 3. Action Buttons: Get Started & High-Contrast GitHub */}
      <div className="mt-7 mb-10 flex flex-wrap items-center justify-center gap-3.5">
        <Link href="/dashboard">
          <Button
            variant="brand"
            className="group shadow-md shadow-red-500/20 w-[136px] h-[38px] font-semibold rounded-lg text-xs sm:text-[13px] flex items-center justify-center gap-1.5"
          >
            <span>Get Started</span>
            <ArrowUpRight className="size-3.5 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
          </Button>
        </Link>

        <Link
          href="https://github.com/d-souptik24/poiex"
          target="_blank"
          rel="noopener noreferrer"
        >
          <Button
            variant="outline"
            className="border-zinc-300/90 dark:border-zinc-700/80 bg-[#eef1f5] hover:bg-[#e2e6ec] text-zinc-900 dark:bg-[#1e2028] dark:hover:bg-[#282b36] dark:text-zinc-100 w-[136px] h-[38px] font-semibold gap-1.5 transition-all shadow-xs rounded-lg text-xs sm:text-[13px] flex items-center justify-center"
          >
            <FaGithub className="size-3.5 shrink-0 text-zinc-800 dark:text-zinc-200" />
            <span>GitHub</span>
          </Button>
        </Link>
      </div>

      {/* 4. Terminal & Code Window with Balanced Theme Contrast */}
      <div className="w-full max-w-3xl mx-auto text-left perspective-[1000px]">
        <div className="relative rounded-2xl border border-zinc-300/90 dark:border-zinc-800 bg-[#f1f3f7] dark:bg-[#121316] shadow-xl dark:shadow-[0_20px_50px_rgba(0,0,0,0.8),0_0_0_1px_rgba(255,255,255,0.06)] transition-all duration-300 hover:border-red-500/40 overflow-hidden group">
          {/* Top Window Chrome: Code Editor Tab Bar */}
          <div className="flex items-center justify-between px-4 py-2.5 border-b border-zinc-200 dark:border-zinc-800 bg-[#e7ebf0] dark:bg-[#181920]">
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1.5 text-zinc-600 dark:text-zinc-400 select-none">
                <FolderOpen className="size-3.5 text-zinc-500 dark:text-zinc-400 shrink-0" />
                <span className="font-mono text-zinc-500 dark:text-zinc-400 text-xs hidden xs:inline">src</span>
                <span className="text-zinc-300 dark:text-zinc-700 font-light select-none text-xs">/</span>
              </div>
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-white dark:bg-[#22242c] border border-zinc-300/80 dark:border-zinc-700/60 text-xs font-mono text-zinc-800 dark:text-zinc-200 font-medium shadow-2xs">
                <FileCode className="size-3.5 text-rose-500" />
                <span>server.ts</span>
              </div>
            </div>

            {/* AI Assistant Status Pill (Matches Real Playground ToggleAI Component) */}
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-xs font-medium text-zinc-900 dark:text-zinc-100 shadow-2xs">
                <Bot className="size-3.5 text-zinc-900 dark:text-zinc-100" />
                <span>AI</span>
                <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse" />
              </div>
              <span className="hidden sm:inline-block text-[11px] font-medium text-zinc-500 dark:text-zinc-400">
                Qwen 2.5 Coder
              </span>
            </div>
          </div>

          {/* Code Body */}
          <div className="p-4 sm:p-6 font-mono text-xs sm:text-[13px] leading-relaxed overflow-x-auto bg-[#f8f9fb] dark:bg-[#0d0e12]">
            <div className="select-none flex flex-col gap-1">
              <div className="flex items-center gap-3">
                <span className="w-6 text-right text-zinc-400 dark:text-zinc-600 opacity-60">1</span>
                <span>
                  <span className="text-purple-700 dark:text-purple-400">import</span>{" "}
                  <span className="text-zinc-900 dark:text-zinc-200">{"{ Hono }"}</span>{" "}
                  <span className="text-purple-700 dark:text-purple-400">from</span>{" "}
                  <span className="text-emerald-700 dark:text-emerald-400">&quot;hono&quot;</span>;
                </span>
              </div>
              <div className="flex items-center gap-3">
                <span className="w-6 text-right text-zinc-400 dark:text-zinc-600 opacity-60">2</span>
                <span className="text-zinc-400 dark:text-zinc-500">{"// Native in-browser WebAssembly execution"}</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="w-6 text-right text-zinc-400 dark:text-zinc-600 opacity-60">3</span>
                <span>
                  <span className="text-blue-700 dark:text-blue-400">const</span>{" "}
                  <span className="text-amber-800 dark:text-yellow-400 font-medium">app</span>{" "}
                  <span className="text-zinc-800 dark:text-zinc-300">=</span>{" "}
                  <span className="text-blue-700 dark:text-blue-400">new</span>{" "}
                  <span className="text-amber-800 dark:text-yellow-400 font-medium">Hono</span>();
                </span>
              </div>
              <div className="flex items-center gap-3">
                <span className="w-6 text-right text-zinc-400 dark:text-zinc-600 opacity-60">4</span>
                <span>&nbsp;</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="w-6 text-right text-zinc-400 dark:text-zinc-600 opacity-60">5</span>
                <span>
                  <span className="text-amber-800 dark:text-yellow-400 font-medium">app</span>.
                  <span className="text-blue-700 dark:text-blue-400">get</span>(
                  <span className="text-emerald-700 dark:text-emerald-400">&quot;/api/health&quot;</span>,{" "}
                  (<span className="text-amber-700 dark:text-amber-400">c</span>) =&gt; {"{"}
                </span>
              </div>
              {/* Natural AI Ghost-Text Completion (Muted Grayed-Out Suggestion) */}
              <div className="flex items-center gap-3">
                <span className="w-6 text-right text-zinc-400 dark:text-zinc-600 opacity-60">6</span>
                <span className="text-zinc-900 dark:text-zinc-200">
                  &nbsp;&nbsp;
                  <span className="text-zinc-400 dark:text-zinc-500 italic">
                    return c.json({"{"} status: &quot;ok&quot;, localAI: true {"}"});
                  </span>
                  <span className="ml-2.5 inline-flex items-center text-[10px] not-italic font-sans text-zinc-600 dark:text-zinc-400 bg-zinc-200 dark:bg-zinc-800/90 px-1.5 py-0.5 rounded border border-zinc-300 dark:border-zinc-700 select-none">
                    Tab to accept
                  </span>
                </span>
              </div>
              <div className="flex items-center gap-3">
                <span className="w-6 text-right text-zinc-400 dark:text-zinc-600 opacity-60">7</span>
                <span className="text-zinc-800 dark:text-zinc-300">{"});"}</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="w-6 text-right text-zinc-400 dark:text-zinc-600 opacity-60">8</span>
                <span>&nbsp;</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="w-6 text-right text-zinc-400 dark:text-zinc-600 opacity-60">9</span>
                <span>
                  <span className="text-purple-700 dark:text-purple-400">export default</span>{" "}
                  <span className="text-amber-800 dark:text-yellow-400 font-medium">app</span>;
                </span>
              </div>
            </div>
          </div>

          {/* Panel Divider with Grab Handle (Matches PoiEx Resizable Panels) */}
          <div className="relative border-t border-zinc-200 dark:border-zinc-800">
            <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-8 h-1 rounded-full bg-zinc-300 dark:bg-zinc-700 select-none pointer-events-none" />
          </div>

          {/* WebContainer Terminal Header (Matches PoiEx TerminalComponent) */}
          <div className="flex items-center justify-between px-3.5 py-2 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-100/90 dark:bg-zinc-900/60 text-zinc-800 dark:text-zinc-200 select-none transition-colors">
            <div className="flex items-center gap-2.5">
              <div className="flex gap-1.5">
                <div className="size-2.5 rounded-full bg-red-500" />
                <div className="size-2.5 rounded-full bg-yellow-500" />
                <div className="size-2.5 rounded-full bg-green-500" />
              </div>
              <span className="text-xs font-medium text-zinc-900 dark:text-zinc-100">WebContainer Terminal</span>
              <div className="flex items-center gap-1.5 ml-1">
                <div className="size-2 rounded-full bg-green-500 animate-pulse" />
                <span className="text-[11px] text-muted-foreground">Connected</span>
              </div>
            </div>

            <div className="flex items-center gap-2 text-zinc-400 dark:text-zinc-500">
              <Copy className="size-3 hover:text-zinc-700 dark:hover:text-zinc-300 transition-colors" />
              <RotateCcw className="size-3 hover:text-zinc-700 dark:hover:text-zinc-300 transition-colors" />
            </div>
          </div>

          {/* WebContainer Terminal Output Body (Authentic In-Browser Execution) */}
          <div className="p-3.5 sm:p-4 font-mono text-[11px] sm:text-xs leading-relaxed bg-[#f8f9fa] dark:bg-[#09090b] text-zinc-700 dark:text-zinc-300 select-none flex flex-col gap-1.5">
            <div className="flex items-center gap-2">
              <span className="text-emerald-600 dark:text-emerald-400 font-semibold">$</span>
              <span className="text-zinc-900 dark:text-zinc-100 font-medium">npm run dev</span>
            </div>
            <div className="text-zinc-500 dark:text-zinc-400">
              &gt; tsx watch src/server.ts
            </div>
            <div className="flex flex-wrap items-center gap-2 text-emerald-700 dark:text-emerald-400 font-medium">
              <span className="size-1.5 rounded-full bg-emerald-500" />
              <span>ready</span>
              <span className="text-zinc-400 dark:text-zinc-500">—</span>
              <span>started server on</span>
              <span className="underline decoration-emerald-500/40 font-mono">http://localhost:3000</span>
              <span className="text-zinc-400 dark:text-zinc-500 font-normal">(240ms)</span>
            </div>
            <div className="text-[11px] text-zinc-400 dark:text-zinc-500 pt-0.5 flex items-center gap-2">
              <span className="size-1 rounded-full bg-zinc-400 dark:bg-zinc-600" />
              <span>WebAssembly runtime active · Silent hot reload enabled</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
