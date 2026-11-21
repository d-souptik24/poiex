"use client";
import React, { useEffect, useState, useRef, useCallback } from "react";

import { transformToWebContainerFormat } from "../hooks/transformer";
import {
  CheckCircle,
  Loader2,
  XCircle,
  Sparkles,
  RefreshCw,
  AlertTriangle,
  Check,
  Copy,
} from "lucide-react";
import { Progress } from "@/components/ui/progress";
import LoadingStep from "@/modules/playground/components/loader";
import { useTheme } from "next-themes";
import { cn } from "@/lib/utils";

import { WebContainer, type WebContainerProcess } from "@webcontainer/api";
import { usePanelRef } from "react-resizable-panels";
import { TemplateFolder } from "@/modules/playground/lib/path-to-json";
import TerminalComponent, { type TerminalRef } from "./terminal";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";
import {
  detectNativePackages,
  formatTerminalNativeWarning,
  isNativeAddonFailure,
  formatNativeFailureDiagnostic,
  detectRepoLanguage,
  extractAllFilePaths,
  type DetectedNativePackage,
} from "../lib/native-packages";

interface WebContainerPreviewProps {
  templateData: TemplateFolder;
  serverUrl: string;
  isLoading: boolean;
  error: string | null;
  instance: WebContainer | null;
  writeFileSync: (path: string, content: string) => Promise<void>;
  forceResetup?: boolean; // Optional prop to force re-setup
  lastSavedAt?: number;
  onExplainError?: (errorLogs: string, explicitPrompt?: string) => void;
  playgroundId?: string;
  isSplitView?: boolean;
  onToggleSplitView?: (split?: boolean) => void;
  activeMobileTab?: "code" | "preview" | "terminal";
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
  isSplitView = true,
  onToggleSplitView,
  activeMobileTab,
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
  const [isEditorMode, setIsEditorMode] = useState(false);
  const [editorModeLang, setEditorModeLang] = useState<string>("Non-Node");
  const [nativeAddonError, setNativeAddonError] = useState<{
    packages: DetectedNativePackage[];
    output: string;
  } | null>(null);
  const [copiedCommand, setCopiedCommand] = useState<string | null>(null);

  const handleCopyCommand = useCallback(async (cmd: string) => {
    try {
      await navigator.clipboard.writeText(cmd);
      setCopiedCommand(cmd);
      setTimeout(() => setCopiedCommand(null), 2000);
    } catch {}
  }, []);

  const terminalRef = useRef<TerminalRef | null>(null);
  const activeDevProcessRef = useRef<WebContainerProcess | null>(null);
  const activeSpawnProcessRef = useRef<WebContainerProcess | null>(null);
  const serverReadyUnsubscribeRef = useRef<(() => void) | null>(null);
  const previewWindowRef = usePanelRef();
  const terminalWindowRef = usePanelRef();
  const [isTerminalMaximized, setIsTerminalMaximized] = useState(false);
  const [prevSplitViewProp, setPrevSplitViewProp] = useState(isSplitView);

  if (prevSplitViewProp !== isSplitView) {
    setPrevSplitViewProp(isSplitView);
    if (isTerminalMaximized) {
      setIsTerminalMaximized(false);
    }
  }

  const handleToggleMaximize = useCallback(() => {
    setIsTerminalMaximized((prev) => {
      const next = !prev;
      const termPanel = terminalWindowRef.current;
      const prevPanel = previewWindowRef.current;
      if (!termPanel || !prevPanel) return next;

      if (next) {
        // Maximize terminal length by minimising preview
        prevPanel.collapse();
        termPanel.resize("100%");
      } else {
        // Restore split: 65% preview to 35% terminal aspect ratio
        if (prevPanel.isCollapsed()) prevPanel.expand();
        prevPanel.resize("65%");
        if (termPanel.isCollapsed()) termPanel.expand();
        termPanel.resize("35%");
      }
      return next;
    });
  }, [previewWindowRef, terminalWindowRef]);

  const handleToggleCollapse = useCallback(() => {
    // Minimise terminal: preview takes full length (100%), terminal is minimised (0%)
    setIsTerminalMaximized(false);
    onToggleSplitView?.(false);
  }, [onToggleSplitView]);

  useEffect(() => {
    const termPanel = terminalWindowRef.current;
    const prevPanel = previewWindowRef.current;
    if (!termPanel || !prevPanel) return;

    if (isSplitView) {
      if (isTerminalMaximized) {
        prevPanel.collapse();
        termPanel.resize("100%");
      } else {
        // Active split view: 65% preview to 35% terminal aspect ratio
        if (prevPanel.isCollapsed()) prevPanel.expand();
        prevPanel.resize("65%");
        if (termPanel.isCollapsed()) termPanel.expand();
        termPanel.resize("35%");
      }
    } else {
      // Inactive middle button: preview screen takes full length of terminal (100%), terminal is minimised (0%)
      termPanel.collapse();
      if (prevPanel.isCollapsed()) prevPanel.expand();
      prevPanel.resize("100%");
    }
  }, [isSplitView, isTerminalMaximized, previewWindowRef, terminalWindowRef]);

  const isSetupRunningRef = useRef(false);
  const setupDoneProjectIdRef = useRef<string | null>(null);

  // Reset setup state when forceResetup changes
  useEffect(() => {
    if (forceResetup) {
      setupDoneProjectIdRef.current = null;
      isSetupRunningRef.current = false;
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setIsSetupComplete(false);
      setPreviewUrl("");
      setCurrentStep(0);
    }
  }, [forceResetup]);

  useEffect(() => {
    // `cancelled` prevents in-flight async ops from updating state after the
    // effect has been cleaned up (e.g. when the user switches playgrounds or
    // `forceResetup` fires before `setupContainer` finishes).
    let cancelled = false;

    async function setupContainer() {
      if (!instance || isSetupRunningRef.current) return;
      if (setupDoneProjectIdRef.current === playgroundId && !forceResetup) return;

      try {
        isSetupRunningRef.current = true;
        setSetupError(null);
        setNativeAddonError(null);
        setIsEditorMode(false);

        const startDevServerProcess = async () => {
          // STEP-4 Start The Server
          if (terminalRef.current?.writeToTerminal) {
            terminalRef.current.writeToTerminal(
              "\r\n🚀  Starting development server...\r\n",
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
          if (cancelled) {
            try {
              startProcess.kill();
            } catch {}
            activeDevProcessRef.current = null;
            return;
          }
          if (terminalRef.current?.registerBackgroundProcess) {
            terminalRef.current.registerBackgroundProcess(startProcess);
          }

          if (serverReadyUnsubscribeRef.current) {
            try {
              serverReadyUnsubscribeRef.current();
            } catch {}
            serverReadyUnsubscribeRef.current = null;
          }

          const unsubscribe = instance.on("server-ready", (port: number, url: string) => {
            if (cancelled) return;
            if (terminalRef.current?.writeToTerminal) {
              terminalRef.current.writeToTerminal(
                `\r\n\x1b[32m🌐  Server ready at\x1b[0m \x1b[4m\x1b[36m${url}\x1b[0m\r\n`,
              );
            }
            terminalRef.current?.renderPrompt?.();
            setPreviewUrl(url);
            setPreviewKey((prev) => prev + 1);
            setIsSetupComplete(true);
            setupDoneProjectIdRef.current = playgroundId || "default";
          });
          serverReadyUnsubscribeRef.current = unsubscribe;

          // Handle start process output - stream to terminal
          startProcess.output.pipeTo(
            new WritableStream({
              write(data) {
                if (terminalRef.current?.writeToTerminal) {
                  terminalRef.current.writeToTerminal(data);
                }
              },
            }),
          ).catch(() => {});
        };

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

          let parsedExistingPkg: Record<string, unknown> = {};
          let isExistingEditorMode = false;
          try {
            parsedExistingPkg = JSON.parse(packageJsonExists);
            isExistingEditorMode = parsedExistingPkg.poiexMode === "editor";
          } catch {}

          if (packageJsonExists && (!playgroundId || isSameProject)) {
            if (isExistingEditorMode) {
              let detectedLang =
                (typeof parsedExistingPkg.detectedLanguage === "string"
                  ? parsedExistingPkg.detectedLanguage
                  : null) || "Non-Node";

              if (detectedLang === "Multi-Language" || detectedLang === "Non-Node") {
                const allFiles = extractAllFilePaths(templateData).filter(
                  (p) => p !== "package.json" && p !== ".poiex-project-id"
                );
                const repoLang = detectRepoLanguage(allFiles);
                if (repoLang.language && repoLang.language !== "Multi-Language" && repoLang.language !== "Non-Node") {
                  detectedLang = repoLang.language;
                  parsedExistingPkg.detectedLanguage = detectedLang;
                  try {
                    await instance.fs.writeFile("package.json", JSON.stringify(parsedExistingPkg, null, 2));
                  } catch {}
                }
              }

              setIsEditorMode(true);
              setEditorModeLang(detectedLang);

              if (terminalRef.current?.writeToTerminal) {
                terminalRef.current.writeToTerminal(
                  `\x1b[90m[poiex]\x1b[0m \x1b[1m\x1b[37m${detectedLang} workspace ready.\x1b[0m \x1b[90mLive preview in standby.\x1b[0m\r\n`
                );
              }
              terminalRef.current?.renderPrompt?.();

              setCurrentStep(4);
              setIsSetupComplete(true);
              setupDoneProjectIdRef.current = playgroundId || "default";
              return;
            }

            // Option 1: Fast Restore for Cached Workspaces (files and packages are already in Wasm storage)
            if (terminalRef.current?.writeToTerminal) {
              terminalRef.current.writeToTerminal(
                "\x1b[90m[poiex]\x1b[0m \x1b[36mRestoring workspace...\x1b[0m Cached files and dependencies found.\r\n",
              );
            }

            setCurrentStep(4);
            await startDevServerProcess();
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
        if (terminalRef.current?.writeToTerminal) {
          terminalRef.current.writeToTerminal(
            "🔄  Transforming template data...\r\n",
          );
        }

        const files = transformToWebContainerFormat(templateData);
        setCurrentStep(2);

        //  Step-2 Mount Files
        if (terminalRef.current?.writeToTerminal) {
          terminalRef.current.writeToTerminal(
            "📁  Mounting files to WebContainer...\r\n",
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
            "✅  Files mounted successfully\r\n",
          );
        }

        // Check if root package.json exists; inspect for non-Node / editor mode
        let hasRootPackageJson = false;
        let packageJsonRaw = "";
        let parsedPkg: Record<string, unknown> = {};

        try {
          packageJsonRaw = await instance.fs.readFile("package.json", "utf8");
          hasRootPackageJson = true;
          parsedPkg = JSON.parse(packageJsonRaw);
        } catch {
          hasRootPackageJson = false;
        }

        if (!hasRootPackageJson || parsedPkg.poiexMode === "editor") {
          let detectedLang =
            (typeof parsedPkg.detectedLanguage === "string"
              ? parsedPkg.detectedLanguage
              : null) || "Non-Node";

          if (detectedLang === "Multi-Language" || detectedLang === "Non-Node") {
            const allFiles = extractAllFilePaths(templateData).filter(
              (p) => p !== "package.json" && p !== ".poiex-project-id"
            );
            const repoLang = detectRepoLanguage(allFiles);
            if (repoLang.language && repoLang.language !== "Multi-Language" && repoLang.language !== "Non-Node") {
              detectedLang = repoLang.language;
              parsedPkg.detectedLanguage = detectedLang;
              try {
                await instance.fs.writeFile("package.json", JSON.stringify(parsedPkg, null, 2));
              } catch {}
            }
          }

          setIsEditorMode(true);
          setEditorModeLang(detectedLang);

          if (terminalRef.current?.writeToTerminal) {
            terminalRef.current.writeToTerminal(
              `\x1b[90m[poiex]\x1b[0m \x1b[1m\x1b[37m${detectedLang} workspace ready.\x1b[0m \x1b[90mLive preview in standby.\x1b[0m\r\n`
            );
          }
          terminalRef.current?.renderPrompt?.();

          setCurrentStep(4);
          setIsSetupComplete(true);
          setupDoneProjectIdRef.current = playgroundId || "default";
          return;
        }

        // Pre-install scan: Detect known native C/C++ packages
        const detectedNative = detectNativePackages(packageJsonRaw);
        if (detectedNative.length > 0) {
          const terminalNotice = formatTerminalNativeWarning(detectedNative);
          if (terminalRef.current?.writeToTerminal && terminalNotice) {
            terminalRef.current.writeToTerminal(terminalNotice);
          }
        }

        setCurrentStep(3);

        // Step-3 Install dependencies
        if (terminalRef.current?.writeToTerminal) {
          terminalRef.current.writeToTerminal(
            "📦  Installing dependencies...\r\n",
          );
        }

        const installArgs = [
          "install",
          "--prefer-offline",
          "--no-audit",
          "--no-fund",
        ];

        let capturedInstallOutput = "";
        const installProcess = await instance.spawn("npm", installArgs);
        activeSpawnProcessRef.current = installProcess;

        if (cancelled) {
          try {
            installProcess.kill();
          } catch {}
          activeSpawnProcessRef.current = null;
          return;
        }

        installProcess.output.pipeTo(
          new WritableStream({
            write(data) {
              capturedInstallOutput += data;
              if (terminalRef.current?.writeToTerminal) {
                terminalRef.current.writeToTerminal(data);
              }
            },
          }),
        ).catch(() => {});

        const installExitCode = await installProcess.exit;
        if (activeSpawnProcessRef.current === installProcess) {
          activeSpawnProcessRef.current = null;
        }
        if (cancelled) return;

        if (installExitCode !== 0) {
          const isPeerDepError =
            capturedInstallOutput.includes("code ERESOLVE") ||
            capturedInstallOutput.includes("Conflicting peer dependency") ||
            capturedInstallOutput.includes("unable to resolve dependency tree");

          if (isPeerDepError) {
            if (terminalRef.current?.writeToTerminal) {
              terminalRef.current.writeToTerminal(
                "\r\n\x1b[33m⚠️ Conflicting peer dependencies detected. Retrying with --legacy-peer-deps...\x1b[0m\r\n",
              );
            }

            const retryProcess = await instance.spawn("npm", [
              ...installArgs,
              "--legacy-peer-deps",
            ]);
            activeSpawnProcessRef.current = retryProcess;

            if (cancelled) {
              try {
                retryProcess.kill();
              } catch {}
              activeSpawnProcessRef.current = null;
              return;
            }

            retryProcess.output.pipeTo(
              new WritableStream({
                write(data) {
                  capturedInstallOutput += data;
                  if (terminalRef.current?.writeToTerminal) {
                    terminalRef.current.writeToTerminal(data);
                  }
                },
              }),
            ).catch(() => {});

            const retryExitCode = await retryProcess.exit;
            if (activeSpawnProcessRef.current === retryProcess) {
              activeSpawnProcessRef.current = null;
            }
            if (cancelled) return;
            if (retryExitCode !== 0) {
              const isNativeFailure = isNativeAddonFailure(capturedInstallOutput);
              if (isNativeFailure || detectedNative.length > 0) {
                if (terminalRef.current?.writeToTerminal) {
                  terminalRef.current.writeToTerminal(
                    formatNativeFailureDiagnostic(capturedInstallOutput, detectedNative),
                  );
                }
                setNativeAddonError({
                  packages: detectedNative,
                  output: capturedInstallOutput,
                });
                setSetupError("Native C/C++ compilation error in WebContainer");
                return;
              }

              throw new Error(
                `Failed to install dependencies. Exit code: ${retryExitCode}`,
              );
            }
          } else {
            const isNativeFailure = isNativeAddonFailure(capturedInstallOutput);
            if (isNativeFailure || detectedNative.length > 0) {
              if (terminalRef.current?.writeToTerminal) {
                terminalRef.current.writeToTerminal(
                  formatNativeFailureDiagnostic(capturedInstallOutput, detectedNative),
                );
              }
              setNativeAddonError({
                packages: detectedNative,
                output: capturedInstallOutput,
              });
              setSetupError("Native C/C++ compilation error in WebContainer");
              return;
            }

            throw new Error(
              `Failed to install dependencies. Exit code: ${installExitCode}`,
            );
          }
        }

        setCurrentStep(4);
        await startDevServerProcess();
      } catch (err) {
        if (cancelled) return;
        console.error("Error setting up container:", err);
        const errorMessage = err instanceof Error ? err.message : String(err);
        if (terminalRef.current?.writeToTerminal) {
          terminalRef.current.writeToTerminal(`❌ Error: ${errorMessage}\r\n`);
        }
        setSetupError(errorMessage);
      } finally {
        isSetupRunningRef.current = false;
      }
    }

    setupContainer();
    return () => {
      cancelled = true;
      if (serverReadyUnsubscribeRef.current) {
        try {
          serverReadyUnsubscribeRef.current();
        } catch {}
        serverReadyUnsubscribeRef.current = null;
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [instance, playgroundId, forceResetup, serverUrl]);

  // Cleanup active dev process and in-flight processes on unmount
  useEffect(() => {
    return () => {
      if (serverReadyUnsubscribeRef.current) {
        try {
          serverReadyUnsubscribeRef.current();
        } catch {}
        serverReadyUnsubscribeRef.current = null;
      }
      if (activeDevProcessRef.current) {
        try {
          activeDevProcessRef.current.kill();
        } catch {}
        activeDevProcessRef.current = null;
      }
      if (activeSpawnProcessRef.current) {
        try {
          activeSpawnProcessRef.current.kill();
        } catch {}
        activeSpawnProcessRef.current = null;
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
        data-mobile-preview-tab={activeMobileTab}
      >
        {/* Top Panel: Setup Progress or Live Preview iframe */}
        <ResizablePanel
          id="preview-window"
          panelRef={previewWindowRef}
          defaultSize="65%"
          minSize="15%"
          collapsible={true}
          collapsedSize="0%"
          className={cn(
            "relative h-full w-full overflow-hidden",
            isTerminalMaximized && "md:pointer-events-none"
          )}
        >
          {nativeAddonError ? (
            <div
              role="alert"
              aria-live="assertive"
              className="h-full w-full flex items-center justify-center p-6 bg-zinc-50 dark:bg-zinc-950 font-sans overflow-y-auto"
            >
              <div className="my-auto bg-white dark:bg-zinc-900 border border-amber-200 dark:border-amber-900/50 shadow-xl rounded-2xl p-6 max-w-xl w-full space-y-4">
                <div className="flex items-start gap-3">
                  <div className="p-2.5 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 shrink-0 mt-0.5">
                    <AlertTriangle className="h-5 w-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-sm text-zinc-900 dark:text-zinc-100">
                        Native C/C++ Dependency Conflict
                      </h3>
                      <span className="px-2 py-0.5 text-[10px] font-medium bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 rounded-full font-mono">
                        node-gyp
                      </span>
                    </div>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1 leading-relaxed">
                      WebContainers run Node.js in browser WebAssembly without host C++ compiler toolchains.
                      Packages requiring native compilation cannot compile in this environment.
                    </p>
                  </div>
                </div>

                {nativeAddonError.packages.length > 0 && (
                  <div className="space-y-2 pt-1">
                    <p className="text-xs font-medium text-zinc-700 dark:text-zinc-300">
                      Detected Incompatible Package{nativeAddonError.packages.length > 1 ? "s" : ""}:
                    </p>
                    <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                      {nativeAddonError.packages.map((pkg) => (
                        <div
                          key={pkg.name}
                          className="p-3 rounded-xl bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 text-xs space-y-1.5"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-semibold font-mono text-rose-600 dark:text-rose-400">
                              {pkg.name}
                            </span>
                            <span className="text-[11px] text-zinc-500 flex items-center gap-1 font-mono">
                              Use <strong className="text-emerald-600 dark:text-emerald-400">{pkg.replacement}</strong>
                            </span>
                          </div>
                          <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                            {pkg.reason}
                          </p>
                          <div className="flex items-center justify-between gap-2 pt-1 bg-zinc-100 dark:bg-zinc-900 px-2 py-1 rounded-md font-mono text-[11px] text-zinc-700 dark:text-zinc-300">
                            <span className="truncate">{pkg.command}</span>
                            <button
                              type="button"
                              onClick={() => handleCopyCommand(pkg.command)}
                              className="text-zinc-400 hover:text-zinc-200 shrink-0 p-0.5 rounded transition-colors"
                              title="Copy command"
                            >
                              {copiedCommand === pkg.command ? (
                                <Check className="h-3 w-3 text-emerald-500" />
                              ) : (
                                <Copy className="h-3 w-3" />
                              )}
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="p-3 rounded-xl bg-zinc-100 dark:bg-zinc-950/80 border border-zinc-200 dark:border-zinc-800 font-mono text-[11px] text-rose-600 dark:text-rose-400 overflow-x-auto max-h-24 leading-relaxed whitespace-pre-wrap select-text">
                  {nativeAddonError.output.slice(-300) || "Build failed: Missing native compiler toolchain"}
                </div>

                <div className="flex items-center gap-2 pt-1">
                  {onExplainError && (
                    <button
                      type="button"
                      onClick={() => {
                        const pkgSummary =
                          nativeAddonError.packages.length > 0
                            ? nativeAddonError.packages
                                .map((p) => `- ${p.name}: replace with ${p.replacement} (${p.reason})`)
                                .join("\n")
                            : "A dependency attempted native C++ compilation (node-gyp).";
                        const prompt = `The project failed to install in WebContainer due to a native C/C++ compilation error.\n\nDetected native packages:\n${pkgSummary}\n\nTerminal output snippet:\n\`\`\`\n${nativeAddonError.output.slice(-1000)}\n\`\`\`\n\nPlease update package.json to replace these native packages with their pure JavaScript or WebAssembly equivalents, and show any import changes needed in the codebase.`;
                        onExplainError(nativeAddonError.output, prompt);
                      }}
                      className="h-8 px-3.5 text-xs bg-[#e93f3f] hover:bg-[#d43535] text-white font-medium gap-1.5 rounded-lg shadow-sm flex items-center transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#e93f3f]"
                    >
                      <Sparkles className="h-3.5 w-3.5" />
                      <span>Fix in PoiEx DevSpace</span>
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
          ) : error || setupError ? (
            <div className="h-full w-full flex items-center justify-center p-6 bg-zinc-50 dark:bg-zinc-950 font-sans overflow-y-auto">
              <div className="my-auto bg-white dark:bg-zinc-900 border border-rose-200 dark:border-rose-900/40 shadow-xl rounded-2xl p-6 max-w-lg w-full space-y-4">
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
                      <span>Diagnose in PoiEx DevSpace</span>
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
            isEditorMode ? (
              <section
                role="region"
                aria-label="Live Preview Standby"
                className="h-full w-full flex items-center justify-center p-6 bg-zinc-50/50 dark:bg-[#0b0d11] select-none font-sans overflow-y-auto"
              >
                <article className="max-w-md w-full p-8 rounded-2xl bg-white/70 dark:bg-zinc-900/40 backdrop-blur-md border border-zinc-200/80 dark:border-white/[0.06] shadow-xl text-center space-y-4 my-auto">
                  {/* Status Pill */}
                  <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-zinc-100/80 dark:bg-zinc-800/60 border border-zinc-200/80 dark:border-zinc-700/50 font-mono text-[11px] text-zinc-700 dark:text-zinc-300">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    <span className="font-semibold">{editorModeLang}</span>
                    <span className="text-zinc-400 dark:text-zinc-500">•</span>
                    <span>Workspace Active</span>
                  </div>

                  {/* Heading */}
                  <h2 className="text-base md:text-lg font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">
                    Live Preview Standby
                  </h2>

                  {/* Tailored Humanized Description */}
                  <p className="text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed max-w-sm mx-auto">
                    In-browser execution is tailored for web applications. For {editorModeLang}, Monaco editing, full file tree management, and PoiEx DevSpace assistance are ready.
                  </p>

                  {/* Subtle Pro-Tip */}
                  <div className="pt-3 border-t border-zinc-200/60 dark:border-zinc-800/60">
                    <p className="text-[11px] text-zinc-400 dark:text-zinc-500">
                      Tip: Ask PoiEx DevSpace to generate a web interface or WebAssembly wrapper to run this in the browser.
                    </p>
                  </div>
                </article>
              </section>
            ) : (
              <div className="h-full w-full flex items-center justify-center p-4 bg-zinc-50/80 dark:bg-muted/10 overflow-y-auto transition-colors">
                {isLoading ? (
                  <LoadingStep
                    title="Initializing WebContainer"
                    description="Setting up the in-browser runtime environment for your project..."
                  />
                ) : isSetupComplete ? (
                  <div className="my-auto w-full max-w-md p-6 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-xl dark:shadow-md text-center space-y-3 font-sans">
                    <div className="w-10 h-10 rounded-full bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto">
                      <CheckCircle className="h-5 w-5" />
                    </div>
                    <div>
                      <h3 className="text-base font-semibold text-foreground">Workspace Ready</h3>
                      <p className="text-xs text-muted-foreground mt-1">
                        Files are mounted and running in WebContainer. Use Monaco to edit code and the terminal below to execute commands.
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="my-auto w-full max-w-md p-6 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-xl dark:shadow-md transition-colors">
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
            )
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
        <ResizableHandle
          withHandle
          className={cn((!isSplitView || isTerminalMaximized) && "hidden", "max-md:hidden")}
        />

        {/* Bottom Panel: WebContainer Terminal */}
        <ResizablePanel
          id="terminal-window"
          panelRef={terminalWindowRef}
          defaultSize="35%"
          minSize="15%"
          collapsible={true}
          collapsedSize="0%"
          className={cn(
            "h-full w-full flex flex-col overflow-hidden transition-colors",
            isDark ? "bg-zinc-950" : "bg-[#F8F9FA]"
          )}
        >
          <TerminalComponent
            ref={terminalRef}
            webContainerInstance={instance}
            theme={isDark ? "dark" : "light"}
            className="h-full w-full"
            onExplainError={onExplainError}
            onToggleCollapse={handleToggleCollapse}
            onToggleMaximize={handleToggleMaximize}
            isMaximized={isTerminalMaximized}
          />
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  );
};

export default WebContainerPreview;
