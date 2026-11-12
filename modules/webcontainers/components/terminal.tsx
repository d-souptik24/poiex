"use client";

import React, { useEffect, useRef, useState, useCallback, forwardRef, useImperativeHandle } from "react";
import { Terminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import { WebLinksAddon } from "@xterm/addon-web-links";
import { SearchAddon } from "@xterm/addon-search";
import "@xterm/xterm/css/xterm.css";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, Copy, Check, Trash2, Download, Sparkles, AlertCircle, X, TerminalSquare } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import type { WebContainer, WebContainerProcess } from "@webcontainer/api";

const terminalThemes = {
  dark: {
    background: "#09090B",
    foreground: "#FAFAFA",
    cursor: "#FAFAFA",
    cursorAccent: "#09090B",
    selection: "#27272A",
    black: "#18181B",
    red: "#EF4444",
    green: "#22C55E",
    yellow: "#EAB308",
    blue: "#3B82F6",
    magenta: "#A855F7",
    cyan: "#06B6D4",
    white: "#F4F4F5",
    brightBlack: "#3F3F46",
    brightRed: "#F87171",
    brightGreen: "#4ADE80",
    brightYellow: "#FDE047",
    brightBlue: "#60A5FA",
    brightMagenta: "#C084FC",
    brightCyan: "#22D3EE",
    brightWhite: "#FFFFFF",
  },
  light: {
    background: "#F8F9FA",
    foreground: "#24292F",
    cursor: "#24292F",
    cursorAccent: "#F8F9FA",
    selection: "#CCE5FF",
    black: "#24292F",
    red: "#CF222E",
    green: "#1A7F37",
    yellow: "#9A6700",
    blue: "#0969DA",
    magenta: "#8250DF",
    cyan: "#1B7C83",
    white: "#FFFFFF",
    brightBlack: "#57606A",
    brightRed: "#A40E26",
    brightGreen: "#116329",
    brightYellow: "#633C01",
    brightBlue: "#0550AE",
    brightMagenta: "#6639BA",
    brightCyan: "#114B53",
    brightWhite: "#FAFBFC",
  },
};

interface TerminalProps {
  webcontainerUrl?: string;
  className?: string;
  theme?: "dark" | "light";
  webContainerInstance?: WebContainer | null;
  onExplainError?: (errorLogs: string) => void;
}

// Define the methods that will be exposed through the ref
export interface TerminalRef {
  writeToTerminal: (data: string) => void;
  clearTerminal: () => void;
  focusTerminal: () => void;
  registerBackgroundProcess?: (process: WebContainerProcess | null) => void;
  resetDirectory?: () => void;
}

function resolvePath(current: string, target: string): string {
  const isAbsolute = target.startsWith("/") || target.startsWith("~");
  const cleanTarget = target.replace(/^~?[/\\]+/, "");

  const baseParts = isAbsolute ? [] : current.split("/").filter(Boolean);
  const targetParts = cleanTarget.split(/[/\\]+/).filter(Boolean);

  for (const part of targetParts) {
    if (part === "." || part === "") {
      continue;
    }
    if (part === "..") {
      if (baseParts.length > 0) {
        baseParts.pop();
      }
    } else {
      baseParts.push(part);
    }
  }
  return baseParts.join("/");
}

const 
TerminalComponent = forwardRef<TerminalRef, TerminalProps>(({ 
  className,
  theme = "dark",
  webContainerInstance,
  onExplainError,
}, ref) => {
  const terminalRef = useRef<HTMLDivElement>(null);
  const term = useRef<Terminal | null>(null);
  const fitAddon = useRef<FitAddon | null>(null);
  const searchAddon = useRef<SearchAddon | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [showSearch, setShowSearch] = useState(false);
  const [detectedError, setDetectedError] = useState<string | null>(null);
  const [hasCopied, setHasCopied] = useState(false);
  
  // Command line state
  const currentDirectory = useRef<string>("");
  const currentLine = useRef<string>("");
  const cursorPosition = useRef<number>(0);
  const commandHistory = useRef<string[]>([]);
  const historyIndex = useRef<number>(-1);
  const currentProcess = useRef<WebContainerProcess | null>(null);
  const backgroundProcess = useRef<WebContainerProcess | null>(null);

  const writePrompt = useCallback(() => {
    if (term.current) {
      const displayPath = currentDirectory.current ? `~/${currentDirectory.current}` : "~";
      term.current.write(`\r\n\x1b[36m${displayPath}\x1b[0m $ `);
      currentLine.current = "";
      cursorPosition.current = 0;
    }
  }, []);

  const redrawLine = useCallback(() => {
    if (!term.current) return;
    const displayPath = currentDirectory.current ? `~/${currentDirectory.current}` : "~";
    const prompt = `\x1b[36m${displayPath}\x1b[0m $ `;
    const remainingAfterCursor = currentLine.current.length - cursorPosition.current;
    if (remainingAfterCursor > 0) {
      term.current.write(`\r\x1b[2K${prompt}${currentLine.current}\x1b[${remainingAfterCursor}D`);
    } else {
      term.current.write(`\r\x1b[2K${prompt}${currentLine.current}`);
    }
  }, []);

  const scanForError = useCallback((data: string) => {
    // Scan for compilation/runtime error patterns
    const errorPattern = /(?:(?:Error|ERR!|SyntaxError|TypeError|ReferenceError|TransformError|Cannot find module|Failed to compile|Failed to find|ERROR):\s*(.+))/i;
    const match = data.match(errorPattern);
    if (match && match[1]) {
      const clean = match[1].replace(/[\u001b\u009b][[()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nqry=><]/g, '').trim();
      if (clean.length > 3) {
        setDetectedError(clean.slice(0, 110));
      }
    }
  }, []);

  // Expose methods through ref
  useImperativeHandle(ref, () => ({
    writeToTerminal: (data: string) => {
      if (term.current) {
        term.current.write(data);
        scanForError(data);
      }
    },
    clearTerminal: () => {
      clearTerminal();
    },
    focusTerminal: () => {
      if (term.current) {
        term.current.focus();
      }
    },
    registerBackgroundProcess: (proc: WebContainerProcess | null) => {
      backgroundProcess.current = proc;
    },
    resetDirectory: () => {
      currentDirectory.current = "";
    },
  }));

  const executeCommand = useCallback(async (command: string) => {
    if (!webContainerInstance || !term.current) return;

    // Add to history
    if (command.trim() && commandHistory.current[commandHistory.current.length - 1] !== command) {
      commandHistory.current.push(command);
    }
    historyIndex.current = -1;

    try {
      // Handle built-in commands
      if (command.trim() === "clear" || command.trim() === "cls") {
        currentLine.current = "";
        cursorPosition.current = 0;
        setDetectedError(null);
        const displayPath = currentDirectory.current ? `~/${currentDirectory.current}` : "~";
        term.current.write(`\x1b[2J\x1b[3J\x1b[H\x1b[36m${displayPath}\x1b[0m $ `);
        return;
      }

      if (command.trim() === "history") {
        commandHistory.current.forEach((cmd, index) => {
          term.current!.writeln(`  ${index + 1}  ${cmd}`);
        });
        writePrompt();
        return;
      }

      if (command.trim() === "") {
        writePrompt();
        return;
      }

      // Parse command: handle quotes, multiple spaces, and carriage returns safely
      const cleanCommand = command.trim().replace(/\r/g, "");
      const rawParts = cleanCommand.match(/(?:[^\s"']+|"[^"]*"|'[^']*')+/g) || [];
      const parts = rawParts.map((p) => p.replace(/^["'](.*)["']$/, "$1"));
      const cmd = parts[0];
      const args = parts.slice(1);

      // Reset error alert on new command execution
      setDetectedError(null);

      // Built-in help command
      if (cmd === "help") {
        term.current.writeln("\r\nPoiEx WebContainer Shell:");
        term.current.writeln("  cd <dir>     Change directory (e.g. cd init, cd ..)");
        term.current.writeln("  pwd          Print current working directory");
        term.current.writeln("  ls           List files and directories");
        term.current.writeln("  node <file>  Run a Node.js script");
        term.current.writeln("  npm <cmd>    Run npm commands (e.g. npm test, npm start)");
        term.current.writeln("  clear        Clear the terminal display");
        term.current.writeln("  history      View previously entered commands");
        writePrompt();
        return;
      }

      // Built-in cd command
      if (cmd === "cd") {
        const target = args[0]?.trim();
        if (!target || target === "~" || target === "/") {
          currentDirectory.current = "";
          writePrompt();
          return;
        }

        const resolved = resolvePath(currentDirectory.current, target);
        if (!resolved) {
          currentDirectory.current = "";
          writePrompt();
          return;
        }

        try {
          await webContainerInstance.fs.readdir(resolved);
          currentDirectory.current = resolved;
        } catch {
          term.current.writeln(`\r\ncd: no such file or directory: ${target}`);
        }
        writePrompt();
        return;
      }

      // Built-in pwd command
      if (cmd === "pwd") {
        const fullPath = currentDirectory.current ? `/${currentDirectory.current}` : "/";
        term.current.writeln(`\r\n${fullPath}`);
        writePrompt();
        return;
      }

      // If user runs a dev/start command manually, terminate any existing background process first to free port 3000
      if (cmd === "npm" && args.some((a) => ["dev", "start", "serve"].includes(a))) {
        if (backgroundProcess.current) {
          try {
            backgroundProcess.current.kill();
          } catch {}
          backgroundProcess.current = null;
          // Short delay to let POSIX network stack release port 3000
          await new Promise((resolve) => setTimeout(resolve, 200));
        }
      }

      // Execute in WebContainer
      term.current.writeln("");
      const process = await webContainerInstance.spawn(cmd, args, {
        cwd: currentDirectory.current || undefined,
        terminal: {
          cols: term.current.cols,
          rows: term.current.rows,
        },
      });

      currentProcess.current = process;

      // Handle process output
      process.output.pipeTo(new WritableStream({
        write(data) {
          if (term.current) {
            term.current.write(data);
            scanForError(data);
          }
        },
      }));

      // Wait for process to complete
      await process.exit;
      currentProcess.current = null;

      // Show new prompt
      writePrompt();

    } catch {
      if (term.current) {
        term.current.writeln(`\r\nCommand not found: ${command}`);
        writePrompt();
      }
      currentProcess.current = null;
    }
  }, [webContainerInstance, writePrompt, scanForError]);

  const handleTerminalInput = useCallback(async (data: string) => {
    if (!term.current) return;

    // If an interactive foreground process is active, forward input directly to it
    if (currentProcess.current) {
      if (data === '\u0003') { // Ctrl+C
        try {
          currentProcess.current.kill();
        } catch {}
        currentProcess.current = null;
        term.current.writeln("^C");
        writePrompt();
        return;
      }
      try {
        const writer = currentProcess.current.input.getWriter();
        writer.write(data);
        writer.releaseLock();
      } catch {}
      return;
    }

    // Handle special keys & escape sequences
    switch (data) {
      case '\r': // Enter
        executeCommand(currentLine.current);
        break;

      case '\u007F': // Backspace
      case '\b':
      case '\u0008':
        if (cursorPosition.current > 0) {
          const pos = cursorPosition.current;
          currentLine.current = currentLine.current.slice(0, pos - 1) + currentLine.current.slice(pos);
          cursorPosition.current--;
          redrawLine();
        }
        break;

      case '\u001b[3~': // Delete
        if (cursorPosition.current < currentLine.current.length) {
          const pos = cursorPosition.current;
          currentLine.current = currentLine.current.slice(0, pos) + currentLine.current.slice(pos + 1);
          redrawLine();
        }
        break;

      case '\u001b[D': // Left arrow
        if (cursorPosition.current > 0) {
          cursorPosition.current--;
          term.current.write('\u001b[D');
        }
        break;

      case '\u001b[C': // Right arrow
        if (cursorPosition.current < currentLine.current.length) {
          cursorPosition.current++;
          term.current.write('\u001b[C');
        }
        break;

      case '\u001b[H':
      case '\u001b[1~':
      case '\u001bOH': // Home
        cursorPosition.current = 0;
        redrawLine();
        break;

      case '\u001b[F':
      case '\u001b[4~':
      case '\u001bOF': // End
        cursorPosition.current = currentLine.current.length;
        redrawLine();
        break;

      case '\t': { // Tab autocompletion
        if (!webContainerInstance) break;
        const line = currentLine.current;
        const lastSpaceIdx = line.lastIndexOf(" ");
        const prefix = lastSpaceIdx >= 0 ? line.slice(lastSpaceIdx + 1) : line;

        try {
          let searchDir = currentDirectory.current || "/";
          let matchPrefix = prefix;

          if (prefix.includes("/")) {
            const slashIdx = prefix.lastIndexOf("/");
            const dirPart = prefix.slice(0, slashIdx);
            matchPrefix = prefix.slice(slashIdx + 1);
            searchDir = resolvePath(currentDirectory.current, dirPart) || "/";
          }

          const entries = await webContainerInstance.fs.readdir(searchDir);
          const matches = entries.filter((e) => e.startsWith(matchPrefix) && !e.startsWith("."));

          if (matches.length === 1) {
            const match = matches[0];
            const completion = match.slice(matchPrefix.length);
            currentLine.current += completion;
            cursorPosition.current = currentLine.current.length;
            redrawLine();
          } else if (matches.length > 1) {
            term.current.writeln(`\r\n${matches.join("  ")}`);
            const displayPath = currentDirectory.current ? `~/${currentDirectory.current}` : "~";
            term.current.write(`\x1b[36m${displayPath}\x1b[0m $ ${currentLine.current}`);
            cursorPosition.current = currentLine.current.length;
          }
        } catch {}
        break;
      }

      case '\u0003': // Ctrl+C
        if (backgroundProcess.current) {
          try {
            backgroundProcess.current.kill();
          } catch {}
          backgroundProcess.current = null;
        }
        term.current.writeln("^C");
        writePrompt();
        break;

      case '\u001b[A': // Up arrow
        if (commandHistory.current.length > 0) {
          if (historyIndex.current === -1) {
            historyIndex.current = commandHistory.current.length - 1;
          } else if (historyIndex.current > 0) {
            historyIndex.current--;
          }
          currentLine.current = commandHistory.current[historyIndex.current];
          cursorPosition.current = currentLine.current.length;
          redrawLine();
        }
        break;

      case '\u001b[B': // Down arrow
        if (historyIndex.current !== -1) {
          if (historyIndex.current < commandHistory.current.length - 1) {
            historyIndex.current++;
            currentLine.current = commandHistory.current[historyIndex.current];
            cursorPosition.current = currentLine.current.length;
          } else {
            historyIndex.current = -1;
            currentLine.current = "";
            cursorPosition.current = 0;
          }
          redrawLine();
        }
        break;

      default:
        // Regular printable characters (ignore raw control codes)
        if (data >= ' ') {
          const pos = cursorPosition.current;
          currentLine.current = 
            currentLine.current.slice(0, pos) + 
            data + 
            currentLine.current.slice(pos);
          cursorPosition.current += data.length;
          redrawLine();
        }
        break;
    }
  }, [executeCommand, writePrompt, redrawLine, webContainerInstance]);

  const initializeTerminal = useCallback(() => {
    if (!terminalRef.current || term.current) return;

    const terminal = new Terminal({
      cursorBlink: true,
      fontFamily: '"Fira Code", "JetBrains Mono", "Consolas", monospace',
      fontSize: 14,
      lineHeight: 1.2,
      letterSpacing: 0,
      theme: terminalThemes[theme],
      allowTransparency: false,
      convertEol: true,
      scrollback: 1000,
      tabStopWidth: 4,
    });

    // Add addons
    const fitAddonInstance = new FitAddon();
    const webLinksAddon = new WebLinksAddon();
    const searchAddonInstance = new SearchAddon();

    terminal.loadAddon(fitAddonInstance);
    terminal.loadAddon(webLinksAddon);
    terminal.loadAddon(searchAddonInstance);

    terminal.open(terminalRef.current);
    
    fitAddon.current = fitAddonInstance;
    searchAddon.current = searchAddonInstance;
    term.current = terminal;

    // Handle terminal input
    terminal.onData(handleTerminalInput);

    // Initial fit
    setTimeout(() => {
      fitAddonInstance.fit();
    }, 100);

    // Welcome message
    terminal.writeln("🚀 WebContainer Terminal");
    terminal.writeln("Type 'help' for available commands");
    writePrompt();

    return terminal;
  }, [theme, handleTerminalInput, writePrompt]);

  const connectToWebContainer = useCallback(async () => {
    if (!webContainerInstance || !term.current) return;

    try {
      setIsConnected(true);
      term.current.writeln("✅ Connected to WebContainer");
      term.current.writeln("Ready to execute commands");
      writePrompt();
    } catch (error) {
      setIsConnected(false);
      term.current.writeln("❌ Failed to connect to WebContainer");
      console.error("WebContainer connection error:", error);
    }
  }, [webContainerInstance, writePrompt]);

  const clearTerminal = useCallback(() => {
    if (term.current) {
      currentLine.current = "";
      cursorPosition.current = 0;
      setDetectedError(null);
      // Clean viewport and scrollback using ANSI escape sequences
      term.current.write("\x1b[2J\x1b[3J\x1b[H");
      term.current.writeln("🚀 WebContainer Terminal");
      writePrompt();
      toast.success("Terminal cleared");
    }
  }, [writePrompt]);

  const copyTerminalContent = useCallback(async () => {
    if (!term.current) return;
    try {
      let content = term.current.getSelection();
      if (!content || !content.trim()) {
        const buffer = term.current.buffer.active;
        const lines: string[] = [];
        for (let i = 0; i < buffer.length; i++) {
          const line = buffer.getLine(i);
          if (line) {
            lines.push(line.translateToString(true));
          }
        }
        content = lines.join("\n").trim();
      }

      if (content) {
        await navigator.clipboard.writeText(content);
        setHasCopied(true);
        setTimeout(() => setHasCopied(false), 2000);
        toast.success("Terminal logs copied to clipboard");
      } else {
        toast.info("Terminal is empty");
      }
    } catch (error) {
      console.error("Failed to copy terminal content:", error);
      toast.error("Failed to copy to clipboard");
    }
  }, []);

  const downloadTerminalLog = useCallback(() => {
    if (!term.current) return;
    try {
      const buffer = term.current.buffer.active;
      const lines: string[] = [];
      
      for (let i = 0; i < buffer.length; i++) {
        const line = buffer.getLine(i);
        if (line) {
          lines.push(line.translateToString(true));
        }
      }

      const content = lines.join("\n").trim();
      if (!content) {
        toast.info("Terminal is empty");
        return;
      }

      const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `terminal-log-${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.txt`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success("Terminal logs downloaded");
    } catch (error) {
      console.error("Failed to download terminal log:", error);
      toast.error("Failed to download logs");
    }
  }, []);

  const searchInTerminal = useCallback((term: string, backward: boolean = false) => {
    if (searchAddon.current && term) {
      if (backward) {
        searchAddon.current.findPrevious(term);
      } else {
        searchAddon.current.findNext(term);
      }
    }
  }, []);

  const getRecentTerminalOutput = useCallback((maxLines: number = 35): string => {
    if (!term.current) return "";

    const selection = term.current.getSelection();
    if (selection && selection.trim().length > 10) {
      return selection.trim();
    }

    const buffer = term.current.buffer.active;
    const lines: string[] = [];

    for (let i = buffer.length - 1; i >= 0 && lines.length < maxLines; i--) {
      const lineObj = buffer.getLine(i);
      if (lineObj) {
        const text = lineObj.translateToString(true).trim();
        if (text) {
          lines.unshift(text);
        }
      }
    }

    return lines.join("\n");
  }, []);

  const handleExplainError = useCallback(() => {
    const output = getRecentTerminalOutput(35);
    if (output && onExplainError) {
      onExplainError(output);
    }
  }, [getRecentTerminalOutput, onExplainError]);

  useEffect(() => {
    initializeTerminal();

    // Handle resize
    const resizeObserver = new ResizeObserver(() => {
      if (fitAddon.current) {
        setTimeout(() => {
          fitAddon.current?.fit();
        }, 100);
      }
    });

    if (terminalRef.current) {
      resizeObserver.observe(terminalRef.current);
    }

    return () => {
      resizeObserver.disconnect();
      if (currentProcess.current) {
        try {
          currentProcess.current.kill();
        } catch {}
      }
      if (backgroundProcess.current) {
        try {
          backgroundProcess.current.kill();
        } catch {}
      }
      if (term.current) {
        term.current.dispose();
        term.current = null;
      }
    };
  }, [initializeTerminal]);

  useEffect(() => {
    if (term.current) {
      term.current.options.theme = terminalThemes[theme];
    }
  }, [theme]);

  useEffect(() => {
    if (webContainerInstance && term.current && !isConnected) {
      connectToWebContainer();
    }
  }, [webContainerInstance, connectToWebContainer, isConnected]);

  return (
    <div className={cn("flex flex-col h-full bg-background border rounded-lg overflow-hidden", className)}>
      {/* Terminal Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-zinc-200 dark:border-border bg-zinc-100/90 dark:bg-muted/50 text-zinc-800 dark:text-zinc-200 transition-colors">
        <div className="flex items-center gap-2">
          <div className="flex gap-1">
            <div className="w-3 h-3 rounded-full bg-red-500"></div>
            <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
            <div className="w-3 h-3 rounded-full bg-green-500"></div>
          </div>
          <span className="text-sm font-medium">WebContainer Terminal</span>
          {isConnected && (
            <div className="flex items-center gap-1">
              <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
              <span className="text-xs text-muted-foreground">Connected</span>
            </div>
          )}
        </div>

        <div className="flex items-center gap-1.5">
          {!detectedError && onExplainError && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleExplainError}
              className={cn(
                "h-6 px-2.5 text-[11px] font-medium gap-1.5 rounded-md border transition-all duration-150 shadow-xs shrink-0 group flex items-center",
                "border-zinc-300 dark:border-zinc-700/80 bg-zinc-100/80 dark:bg-zinc-800/80 hover:bg-zinc-200/80 dark:hover:bg-zinc-700/80 text-zinc-700 dark:text-zinc-200 hover:text-zinc-950 dark:hover:text-zinc-50 hover:border-cyan-500/40"
              )}
              title="Inspect recent terminal activity and diagnose errors with AI"
            >
              <TerminalSquare className="h-3 w-3 text-cyan-500 dark:text-cyan-400 transition-transform duration-150 group-hover:scale-110" />
              <span className="hidden sm:inline font-mono text-[10.5px]">AI Diagnostics</span>
              <span className="sm:hidden font-mono text-[10.5px]">AI</span>
            </Button>
          )}

          {showSearch && (
            <div className="flex items-center gap-1.5 animate-in fade-in slide-in-from-right-2 duration-150">
              <Input
                placeholder="Search logs... (Enter/Shift+Enter)"
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  searchInTerminal(e.target.value);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    searchInTerminal(searchTerm, e.shiftKey);
                  } else if (e.key === "Escape") {
                    setShowSearch(false);
                  }
                }}
                className="h-6 w-44 text-xs px-2 py-0 bg-background border-zinc-300 dark:border-zinc-700 focus-visible:ring-1"
                autoFocus
              />
            </div>
          )}
          
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowSearch(!showSearch)}
            className={cn(
              "h-6 w-6 p-0 rounded transition-colors",
              showSearch
                ? "bg-zinc-200 dark:bg-zinc-700 text-zinc-900 dark:text-zinc-100"
                : "text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-200/70 dark:hover:bg-zinc-800"
            )}
            title="Search in terminal (Ctrl+F)"
          >
            <Search className="h-3 w-3" />
          </Button>
          
          <Button
            variant="ghost"
            size="sm"
            onClick={copyTerminalContent}
            className="h-6 w-6 p-0 rounded text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-200/70 dark:hover:bg-zinc-800 transition-colors"
            title="Copy terminal output"
          >
            {hasCopied ? <Check className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3" />}
          </Button>
          
          <Button
            variant="ghost"
            size="sm"
            onClick={downloadTerminalLog}
            className="h-6 w-6 p-0 rounded text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-200/70 dark:hover:bg-zinc-800 transition-colors"
            title="Download terminal log (.txt)"
          >
            <Download className="h-3 w-3" />
          </Button>
          
          <Button
            variant="ghost"
            size="sm"
            onClick={clearTerminal}
            className="h-6 w-6 p-0 rounded text-zinc-500 dark:text-zinc-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-zinc-200/70 dark:hover:bg-zinc-800 transition-colors"
            title="Clear terminal buffer"
          >
            <Trash2 className="h-3 w-3" />
          </Button>
        </div>
      </div>

      {/* Beautiful Process Error Alert Banner */}
      {detectedError && (
        <div className="flex items-center justify-between px-3 py-1.5 bg-rose-500/10 border-b border-rose-500/25 text-rose-600 dark:text-rose-400 text-xs animate-in slide-in-from-top-1 duration-200 shrink-0">
          <div className="flex items-center gap-2 truncate pr-2">
            <AlertCircle className="w-3.5 h-3.5 shrink-0 text-rose-500" />
            <span className="font-semibold text-[11px] uppercase tracking-wide shrink-0">Runtime Error:</span>
            <span className="truncate font-mono text-[11px] text-zinc-800 dark:text-zinc-200">{detectedError}</span>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            {onExplainError && (
              <Button
                size="sm"
                onClick={handleExplainError}
                className="h-6 px-2 text-[11px] bg-rose-600 hover:bg-rose-700 text-white font-medium gap-1 rounded shadow-xs"
              >
                <Sparkles className="w-3 h-3" />
                <span>Explain & Fix with AI</span>
              </Button>
            )}
            <button
              type="button"
              onClick={() => setDetectedError(null)}
              className="p-1 hover:bg-rose-500/20 rounded text-zinc-400 hover:text-zinc-200 transition-colors"
              title="Dismiss error alert"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* Terminal Content */}
      <div className="flex-1 relative">
        <div 
          ref={terminalRef} 
          className="absolute inset-0 p-2"
          style={{ 
            background: terminalThemes[theme].background,
          }}
        />
      </div>
    </div>
  );
});

TerminalComponent.displayName = "TerminalComponent";

export default TerminalComponent;