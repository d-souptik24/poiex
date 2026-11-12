"use client";
import React, { useEffect, useState, useRef } from "react";

import { transformToWebContainerFormat } from "../hooks/transformer";
import { CheckCircle, Loader2, XCircle, Sparkles, RefreshCw } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import LoadingStep from "@/modules/playground/components/loader";
import { useTheme } from "next-themes";
import { cn } from "@/lib/utils";

import { WebContainer, type WebContainerProcess } from "@webcontainer/api";
import { TemplateFolder } from "@/modules/playground/lib/path-to-json";
import TerminalComponent, { type TerminalRef } from "./terminal";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";

interface WebContainerPreviewProps {
  templateData: TemplateFolder;
  serverUrl: string;
  isLoading: boolean;
  error: string | null;
  instance: WebContainer | null;
  writeFileSync: (path: string, content: string) => Promise<void>;
  forceResetup?: boolean; // Optional prop to force re-setup
  lastSavedAt?: number;
  onExplainError?: (errorLogs: string) => void;
  playgroundId?: string;
}
const WebContainerPreview = ({
  templateData,
  error,
  instance,
  isLoading,
  serverUrl,
  forceResetup = false,
  lastSavedAt,
  onExplainError,
  playgroundId,
}: WebContainerPreviewProps) => {
  const [previewUrl, setPreviewUrl] = useState<string>(serverUrl || "");
  const activePreviewUrl = previewUrl || serverUrl || "";
  const [previewKey, setPreviewKey] = useState<number>(0);
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme !== "light";
  const [currentStep, setCurrentStep] = useState(0);
  const totalSteps = 4;
  const [setupError, setSetupError] = useState<string | null>(null);
  const [isSetupComplete, setIsSetupComplete] = useState(false);
  const [isSetupInProgress, setIsSetupInProgress] = useState(false);

  const terminalRef = useRef<TerminalRef | null>(null);
  const activeDevProcessRef = useRef<WebContainerProcess | null>(null);

  // Reset setup state when forceResetup changes
  useEffect(() => {
    if (forceResetup) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setIsSetupComplete(false);
      setIsSetupInProgress(false);
      setPreviewUrl("");
      setCurrentStep(0);
    }
  }, [forceResetup]);


  useEffect(() => {
    async function setupContainer() {
      if (!instance || isSetupComplete || isSetupInProgress) return;

      try {
        setIsSetupInProgress(true);
        setSetupError(null);

        try {
          let isSameProject = false;
          if (playgroundId) {
            try {
              const currentProjectId = await instance.fs.readFile(
                ".poiex-project-id",
                "utf8"
              );
              isSameProject = currentProjectId.trim() === playgroundId.trim();
            } catch {
              isSameProject = false;
            }
          }

          const packageJsonExists = await instance.fs.readFile(
            "package.json",
            "utf8",
          );

          if (packageJsonExists && (!playgroundId || isSameProject)) {
            if (serverUrl) {
              setPreviewUrl(serverUrl);
              setPreviewKey((prev) => prev + 1);
              setIsSetupComplete(true);
              setIsSetupInProgress(false);
              return;
            }
            // Files are already mounted, just reconnect to existing server
            if (terminalRef.current?.writeToTerminal) {
              terminalRef.current.writeToTerminal(
                "🔄 Reconnecting to existing WebContainer session...\r\n",
              );
            }

            instance.on("server-ready", (port: number, url: string) => {
              if (terminalRef.current?.writeToTerminal) {
                terminalRef.current.writeToTerminal(
                  `🌐 Reconnected to server at ${url}\r\n`,
                );
              }

              setPreviewUrl(url);
              setPreviewKey((prev) => prev + 1);
              setIsSetupComplete(true);
              setIsSetupInProgress(false);
            });

            setCurrentStep(4);
            return;
          }
        } catch {}

        // If switching projects, stop existing server and clean root directory to prevent file pollution
        const previousProcess = activeDevProcessRef.current as WebContainerProcess | null;
        if (previousProcess) {
          try {
            previousProcess.kill();
          } catch {}
          activeDevProcessRef.current = null;
        }

        try {
          const rootEntries = await instance.fs.readdir("/");
          for (const entry of rootEntries) {
            try {
              await instance.fs.rm(entry, { recursive: true, force: true });
            } catch {}
          }
        } catch {}

        if (terminalRef.current?.resetDirectory) {
          terminalRef.current.resetDirectory();
        }

        // Step-1 transform data
        setCurrentStep(1);
        // Write to terminal
        if (terminalRef.current?.writeToTerminal) {
          terminalRef.current.writeToTerminal(
            "🔄 Transforming template data...\r\n",
          );
        }

        // @ts-expect-error templateData format is verified before mount
        const files = transformToWebContainerFormat(templateData);
        setCurrentStep(2);

        //  Step-2 Mount Files

        if (terminalRef.current?.writeToTerminal) {
          terminalRef.current.writeToTerminal(
            "📁 Mounting files to WebContainer...\r\n",
          );
        }
        await instance.mount(files);

        if (playgroundId) {
          try {
            await instance.fs.writeFile(".poiex-project-id", playgroundId);
          } catch {}
        }

        if (terminalRef.current?.writeToTerminal) {
          terminalRef.current.writeToTerminal(
            "✅ Files mounted successfully\r\n",
          );
        }

        // Check if root package.json exists; skip install and server boot for non-Node repos
        let hasRootPackageJson = false;
        try {
          await instance.fs.readFile("package.json", "utf8");
          hasRootPackageJson = true;
        } catch {
          hasRootPackageJson = false;
        }

        if (!hasRootPackageJson) {
          if (terminalRef.current?.writeToTerminal) {
            terminalRef.current.writeToTerminal(
              "ℹ️ No root package.json found — running in Editor mode\r\n",
            );
          }
          setCurrentStep(4);
          setIsSetupComplete(true);
          setIsSetupInProgress(false);
          return;
        }

        setCurrentStep(3);

        // Step-3 Install dependencies

        if (terminalRef.current?.writeToTerminal) {
          terminalRef.current.writeToTerminal(
            "📦 Installing dependencies...\r\n",
          );
        }

        const installProcess = await instance.spawn("npm", ["install"]);

        installProcess.output.pipeTo(
          new WritableStream({
            write(data) {
              if (terminalRef.current?.writeToTerminal) {
                terminalRef.current.writeToTerminal(data);
              }
            },
          }),
        );

        const installExitCode = await installProcess.exit;

        if (installExitCode !== 0) {
          throw new Error(
            `Failed to install dependencies. Exit code: ${installExitCode}`,
          );
        }

        if (terminalRef.current?.writeToTerminal) {
          terminalRef.current.writeToTerminal(
            "✅ Dependencies installed successfully\r\n",
          );
        }

        setCurrentStep(4);

        // STEP-4 Start The Server

        if (terminalRef.current?.writeToTerminal) {
          terminalRef.current.writeToTerminal(
            "🚀 Starting development server...\r\n",
          );
        }

        // Dynamically detect script: prefer dev, then start, then serve, or fallback to node entrypoint
        let scriptName: string | null = null;
        try {
          const packageJsonContent = await instance.fs.readFile(
            "package.json",
            "utf8",
          );
          const pkg = JSON.parse(packageJsonContent);
          const scripts = pkg.scripts || {};
          if (scripts.dev) {
            scriptName = "dev";
          } else if (scripts.start) {
            scriptName = "start";
          } else if (scripts.serve) {
            scriptName = "serve";
          }
        } catch {
          scriptName = "dev";
        }

        const currentDevProcess = activeDevProcessRef.current as WebContainerProcess | null;
        if (currentDevProcess) {
          try {
            currentDevProcess.kill();
          } catch {}
          activeDevProcessRef.current = null;
        }
        let startProcess: WebContainerProcess;
        if (scriptName) {
          startProcess = await instance.spawn("npm", ["run", scriptName]);
        } else {
          let entryFile: string | null = null;
          for (const f of ["app.js", "server.js", "index.js"]) {
            try {
              await instance.fs.readFile(f, "utf8");
              entryFile = f;
              break;
            } catch {}
          }
          if (entryFile) {
            startProcess = await instance.spawn("node", [entryFile]);
          } else {
            startProcess = await instance.spawn("npm", ["start"]);
          }
        }
        activeDevProcessRef.current = startProcess;
        if (terminalRef.current?.registerBackgroundProcess) {
          terminalRef.current.registerBackgroundProcess(startProcess);
        }

        instance.on("server-ready", (port: number, url: string) => {
          if (terminalRef.current?.writeToTerminal) {
            terminalRef.current.writeToTerminal(
              `🌐 Server ready at ${url}\r\n`,
            );
          }
          setPreviewUrl(url);
          setPreviewKey((prev) => prev + 1);
          setIsSetupComplete(true);
          setIsSetupInProgress(false);
        });

        // Handle start process output - stream to terminal
        startProcess.output.pipeTo(
          new WritableStream({
            write(data) {
              if (terminalRef.current?.writeToTerminal) {
                terminalRef.current.writeToTerminal(data);
              }
            },
          }),
        );
      } catch (err) {
        console.error("Error setting up container:", err);
        const errorMessage = err instanceof Error ? err.message : String(err);
        if (terminalRef.current?.writeToTerminal) {
          terminalRef.current.writeToTerminal(`❌ Error: ${errorMessage}\r\n`);
        }
        setSetupError(errorMessage);
        setIsSetupInProgress(false);
      }
    }

    setupContainer();
  }, [instance, templateData, isSetupComplete, isSetupInProgress]);

  // Cleanup active dev process on unmount
  useEffect(() => {
    return () => {
      if (activeDevProcessRef.current) {
        try {
          activeDevProcessRef.current.kill();
        } catch {}
        activeDevProcessRef.current = null;
      }
    };
  }, []);

  // Silently reload preview when a file is saved
  useEffect(() => {
    if (!lastSavedAt || !isSetupComplete) return;

    const timer = setTimeout(() => {
      setPreviewKey((prev) => prev + 1);
    }, 400);

    return () => clearTimeout(timer);
  }, [lastSavedAt, isSetupComplete]);

  const getStepIcon = (stepIndex: number) => {
    if (stepIndex < currentStep) {
      return <CheckCircle className="h-5 w-5 text-emerald-500" />;
    } else if (stepIndex === currentStep) {
      return <Loader2 className="h-5 w-5 animate-spin text-[#e93f3f]" />;
    } else {
      return <div className="h-5 w-5 rounded-full border-2 border-zinc-300 dark:border-zinc-700" />;
    }
  };

  const getStepText = (stepIndex: number, label: string) => {
    const isActive = stepIndex === currentStep;
    const isComplete = stepIndex < currentStep;

    return (
      <span
        className={`text-sm font-medium ${
          isComplete
            ? "text-emerald-600 dark:text-emerald-400"
            : isActive
              ? "text-[#e93f3f] dark:text-[#ff5252]"
              : "text-zinc-500 dark:text-zinc-400"
        }`}
      >
        {label}
      </span>
    );
  };

  return (
    <div className="h-full w-full flex flex-col overflow-hidden">
      <ResizablePanelGroup
        orientation="vertical"
        className="h-full w-full"
      >
        {/* Top Panel: Setup Progress or Live Preview iframe */}
        <ResizablePanel
          id="preview-window"
          defaultSize={60}
          minSize={15}
          className="relative h-full w-full overflow-hidden"
        >
          {error || setupError ? (
            <div className="h-full w-full flex items-center justify-center p-6 bg-zinc-50 dark:bg-zinc-950 font-sans overflow-y-auto">
              <div className="bg-white dark:bg-zinc-900 border border-rose-200 dark:border-rose-900/40 shadow-xl rounded-2xl p-6 max-w-lg w-full space-y-4">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-xl bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20 shrink-0">
                    <XCircle className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-sm text-zinc-900 dark:text-zinc-100">WebContainer Runtime Error</h3>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400">The execution process encountered a failure</p>
                  </div>
                </div>

                <div className="p-3.5 rounded-xl bg-zinc-100 dark:bg-zinc-950/80 border border-zinc-200 dark:border-zinc-800 font-mono text-xs text-rose-600 dark:text-rose-400 overflow-x-auto max-h-40 leading-relaxed whitespace-pre-wrap select-text">
                  {error || setupError || "Unknown execution error"}
                </div>

                <div className="flex items-center gap-2 pt-1">
                  {onExplainError && (
                    <button
                      type="button"
                      onClick={() => onExplainError(error || setupError || "Unknown execution error")}
                      className="h-8 px-3 text-xs bg-rose-600 hover:bg-rose-700 text-white font-medium gap-1.5 rounded-lg shadow-sm flex items-center transition-colors"
                    >
                      <Sparkles className="h-3.5 w-3.5" />
                      <span>Explain & Fix with AI</span>
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => window.location.reload()}
                    className="h-8 px-3 text-xs border border-zinc-300 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300 rounded-lg flex items-center gap-1.5 transition-colors"
                  >
                    <RefreshCw className="h-3.5 w-3.5" />
                    <span>Reload Workspace</span>
                  </button>
                </div>
              </div>
            </div>
          ) : !activePreviewUrl ? (
            <div className="h-full w-full flex items-center justify-center p-4 bg-zinc-50/80 dark:bg-muted/10 overflow-y-auto transition-colors">
              {isLoading ? (
                <LoadingStep
                  title="Initializing WebContainer"
                  description="Setting up the in-browser runtime environment for your project..."
                />
              ) : isSetupComplete ? (
                <div className="w-full max-w-md p-6 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-xl dark:shadow-md text-center space-y-3">
                  <div className="w-10 h-10 rounded-full bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto">
                    <CheckCircle className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-semibold text-foreground">Editor Mode Active</h3>
                    <p className="text-xs text-muted-foreground mt-1">
                      No root <code className="text-foreground">package.json</code> was found. Files are mounted and ready for editing in Monaco and running commands in the terminal.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="w-full max-w-md p-6 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-xl dark:shadow-md transition-colors">
                  <Progress
                    value={(currentStep / totalSteps) * 100}
                    className="h-2 mb-6 [&_[data-slot=progress-indicator]]:bg-[#E93F3F]"
                  />

                  <div className="space-y-4 mb-2">
                    <div className="flex items-center gap-3">
                      {getStepIcon(1)}
                      {getStepText(1, "Transforming template data")}
                    </div>
                    <div className="flex items-center gap-3">
                      {getStepIcon(2)}
                      {getStepText(2, "Mounting files")}
                    </div>
                    <div className="flex items-center gap-3">
                      {getStepIcon(3)}
                      {getStepText(3, "Installing dependencies")}
                    </div>
                    <div className="flex items-center gap-3">
                      {getStepIcon(4)}
                      {getStepText(4, "Starting development server")}
                    </div>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <iframe
              key={previewKey}
              src={activePreviewUrl}
              className="w-full h-full border-none"
              title="WebContainer Preview"
            />
          )}
        </ResizablePanel>

        {/* Resizable Handle between Preview & Terminal */}
        <ResizableHandle withHandle />

        {/* Bottom Panel: WebContainer Terminal (Permanently mounted to maintain output & session) */}
        <ResizablePanel
          id="terminal-window"
          defaultSize={40}
          minSize={15}
          className={cn("h-full w-full flex flex-col overflow-hidden transition-colors", isDark ? "bg-zinc-950" : "bg-[#F8F9FA]")}
        >
          <TerminalComponent
            ref={terminalRef}
            webContainerInstance={instance}
            theme={isDark ? "dark" : "light"}
            className="h-full w-full"
            onExplainError={onExplainError}
          />
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  );
};

export default WebContainerPreview;
