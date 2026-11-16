"use client";

import type React from "react";
import { useState, useEffect, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";

import {
  Loader2,
  ArrowUp,
  User,
  Copy,
  Check,
  FileCode,
  X,
  Code,
  Sparkles,
  MessageSquare,
  RotateCw,
  Settings,
  Zap,
  Download,
  PanelLeftClose,
  PanelLeftOpen,
  SquarePen,
  MoreHorizontal,
  Pencil,
  Trash2,
  ShieldCheck,
  AlertCircle,
  ArrowLeftRight,
  ChevronDown,
} from "lucide-react";

import { cn } from "@/lib/utils";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import { TooltipProvider } from "@/components/ui/tooltip";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuCheckboxItem,
  DropdownMenuLabel,
  DropdownMenuGroup,
} from "@/components/ui/dropdown-menu";
import "katex/dist/katex.min.css";
import Image from "next/image";
import type { AIModelOption } from "@/app/api/models/route";
import {
  getChatSessions,
  getChatSessionMessages,
  renameChatSession,
  deleteChatSession,
  type ChatSessionItem,
} from "../actions";
import { toast } from "sonner";
import { useCurrentUser } from "@/modules/auth/hooks/use-current-user";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  id: string;
  timestamp: Date;
  type?:
    | "chat"
    | "code_review"
    | "suggestion"
    | "error_fix"
    | "optimization"
    | "error";
  tokens?: number;
  model?: string;
}

interface AIChatSidePanelProps {
  isOpen: boolean;
  onClose: () => void;
  activeFileName?: string;
  activeFileContent?: string;
  onApplyCode?: (code: string) => void;
  onReviewDiff?: (code: string) => void;
  isDocked?: boolean;
  playgroundId?: string;
  initialPrompt?: string;
  initialMode?: "chat" | "review" | "fix" | "optimize";
}

const CodeBlockItem = ({
  language,
  code,
  onApplyCode,
  onReviewDiff,
  activeFileName,
}: {
  language: string;
  code: string;
  onApplyCode?: (code: string) => void;
  onReviewDiff?: (code: string) => void;
  activeFileName?: string;
}) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="w-full rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-100/60 dark:bg-[#0e0e12] my-4 overflow-hidden shadow-xs font-sans">
      <div className="flex items-center justify-between px-3.5 py-2 bg-zinc-100 dark:bg-[#16161c] border-b border-zinc-200 dark:border-zinc-800/80 text-xs text-zinc-600 dark:text-zinc-400">
        <span className="font-mono text-[10.5px] text-zinc-700 dark:text-zinc-300 uppercase tracking-wider font-semibold">
          {language || "code"}
        </span>
        <div className="flex items-center gap-1.5">
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={handleCopy}
            className="h-6 px-2 text-[11px] text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-200/70 dark:hover:bg-zinc-800"
          >
            {copied ? (
              <>
                <Check className="h-3 w-3 mr-1 text-emerald-600 dark:text-emerald-400" />
                <span className="text-emerald-600 dark:text-emerald-400 font-medium">
                  Copied
                </span>
              </>
            ) : (
              <>
                <Copy className="h-3 w-3 mr-1" />
                <span>Copy</span>
              </>
            )}
          </Button>
          {onReviewDiff && (
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => onReviewDiff(code)}
              className="h-6 px-2.5 text-[11px] border-zinc-300 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 hover:text-zinc-950 dark:hover:text-zinc-100 flex items-center gap-1 shadow-xs"
              title="Review side-by-side diff against editor"
            >
              <ArrowLeftRight className="h-3 w-3 text-cyan-500" />
              <span>Review Diff</span>
            </Button>
          )}
          {onApplyCode && (
            <Button
              type="button"
              size="sm"
              variant="default"
              onClick={() => onApplyCode(code)}
              className="h-6 px-2.5 text-[11px] font-semibold bg-[#e93f3f] hover:bg-[#d43535] text-white flex items-center gap-1 shadow-xs rounded-md"
              title={
                activeFileName
                  ? `Apply to ${activeFileName}`
                  : "Apply to editor"
              }
            >
              <FileCode className="h-3 w-3" />
              <span>Apply</span>
            </Button>
          )}
        </div>
      </div>
      <pre className="p-4 text-xs font-mono text-zinc-900 dark:text-zinc-100 overflow-x-auto leading-relaxed bg-zinc-50/50 dark:bg-[#0a0a0d]">
        <code>{code}</code>
      </pre>
    </div>
  );
};

const MessageTypeIndicator: React.FC<{
  type?: string;
  model?: string;
  tokens?: number;
}> = ({ type, model, tokens }) => {
  if (!type || type === "chat" || type === "error") {
    return null;
  }

  const getTypeConfig = (t?: string) => {
    switch (t) {
      case "code_review":
        return {
          icon: Code,
          color: "text-blue-600 dark:text-blue-400",
          label: "Code Review",
        };
      case "suggestion":
        return {
          icon: Sparkles,
          color: "text-purple-600 dark:text-purple-400",
          label: "Suggestion",
        };
      case "error_fix":
        return {
          icon: ShieldCheck,
          color: "text-rose-600 dark:text-rose-400",
          label: "Error Fix",
        };
      case "optimization":
        return {
          icon: Zap,
          color: "text-amber-600 dark:text-yellow-400",
          label: "Optimization",
        };
      default:
        return null;
    }
  };

  const config = getTypeConfig(type);
  if (!config) return null;
  const Icon = config.icon;

  return (
    <div className="flex items-center justify-between mb-2.5 pb-2 border-b border-zinc-100 dark:border-zinc-800/60 font-sans">
      <div className="flex items-center gap-1.5">
        <Icon className={cn("h-3.5 w-3.5", config.color)} />
        <span className={cn("text-xs font-semibold", config.color)}>
          {config.label}
        </span>
      </div>
      <div className="flex items-center gap-2 text-[10px] text-zinc-500 dark:text-zinc-400 font-mono">
        {model && <span>{model}</span>}
        {tokens && <span>{tokens} tokens</span>}
      </div>
    </div>
  );
};

export const AIChatSidePanel: React.FC<AIChatSidePanelProps> = ({
  isOpen,
  onClose,
  activeFileName,
  activeFileContent,
  onApplyCode,
  onReviewDiff,
  isDocked = false,
  playgroundId,
  initialPrompt,
  initialMode,
}) => {
  const currentUser = useCurrentUser();

  const sessionStorageKey = playgroundId
    ? `poiex-chat-active-session-${playgroundId}`
    : "poiex-chat-active-session";

  // Chat & Thread Sessions State
  const [sessions, setSessions] = useState<ChatSessionItem[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const activeSessionIdRef = useRef<string | null>(null);
  useEffect(() => {
    activeSessionIdRef.current = activeSessionId;
  }, [activeSessionId]);
  const [activeSessionTitle, setActiveSessionTitle] =
    useState<string>("New Chat");
  const [isSidebarOpen, setIsSidebarOpenState] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem("poiex-chat-sidebar-open");
      return saved !== null ? saved === "true" : true;
    } catch {
      return true;
    }
  });

  const setIsSidebarOpen = useCallback((val: boolean) => {
    setIsSidebarOpenState(val);
    try {
      localStorage.setItem("poiex-chat-sidebar-open", String(val));
    } catch {}
  }, []);
  const [isSessionsLoading, setIsSessionsLoading] = useState(false);
  const [editingSessionId, setEditingSessionId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState("");

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const promptTextareaRef = useRef<HTMLTextAreaElement>(null);
  const [chatMode, setChatModeState] = useState<
    "chat" | "review" | "fix" | "optimize"
  >(() => {
    try {
      const saved = localStorage.getItem("poiex-chat-mode");
      if (saved && ["chat", "review", "fix", "optimize"].includes(saved)) {
        return saved as "chat" | "review" | "fix" | "optimize";
      }
    } catch {}
    return "chat";
  });

  const setChatMode = useCallback(
    (mode: "chat" | "review" | "fix" | "optimize") => {
      setChatModeState(mode);
      try {
        localStorage.setItem("poiex-chat-mode", mode);
      } catch {}
    },
    [],
  );

  useEffect(() => {
    if (initialPrompt && initialPrompt.trim()) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setInput(initialPrompt);
      if (initialMode) {
        setChatMode(initialMode);
      }
      setTimeout(() => {
        promptTextareaRef.current?.focus();
      }, 150);
    }
  }, [initialPrompt, initialMode, setChatMode]);

  const [autoSave, setAutoSaveState] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem("poiex-chat-auto-save");
      return saved !== null ? saved === "true" : true;
    } catch {
      return true;
    }
  });

  const setAutoSave = useCallback((val: boolean) => {
    setAutoSaveState(val);
    try {
      localStorage.setItem("poiex-chat-auto-save", String(val));
    } catch {}
  }, []);
  const [streamResponse, setStreamResponseState] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem("poiex-chat-stream-response");
      return saved !== null ? saved === "true" : true;
    } catch {
      return true;
    }
  });

  const setStreamResponse = useCallback((val: boolean) => {
    setStreamResponseState(val);
    try {
      localStorage.setItem("poiex-chat-stream-response", String(val));
    } catch {}
  }, []);
  const isFullScreen = true;

  // Curated model state
  const [model, setModel] = useState<string>("gemini-3.5-flash-lite");
  const [availableModels, setAvailableModels] = useState<AIModelOption[]>([]);
  const [isModelLoading, setIsModelLoading] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const renameInputRef = useRef<HTMLInputElement>(null);

  const handleTextareaInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    e.target.style.height = "auto";
    e.target.style.height = `${Math.min(e.target.scrollHeight, 108)}px`;
  };

  // Fetch the curated models and check availability
  const fetchModels = useCallback(async () => {
    try {
      setIsModelLoading(true);
      const res = await fetch("/api/models");
      if (res.ok) {
        const data = await res.json();
        const fetchedModels: AIModelOption[] = data.models || [];
        setAvailableModels(fetchedModels);

        let saved = localStorage.getItem("poiex-ai-model");
        if (saved === "poiex3.0-uncensored:2B") {
          saved = "poiex3.0-uncensored";
          try {
            localStorage.setItem("poiex-ai-model", "poiex3.0-uncensored");
          } catch {}
        }
        const savedModelObj = saved
          ? fetchedModels.find((m) => m.id === saved)
          : undefined;

        if (saved && savedModelObj && savedModelObj.isAvailable) {
          setModel(saved);
        } else if (savedModelObj && !savedModelObj.isAvailable) {
          const fallback = data.defaultModel || "gemini-3.5-flash-lite";
          setModel(fallback);
          try {
            localStorage.setItem("poiex-ai-model", fallback);
          } catch {}
          toast.info(
            `Model ${savedModelObj.name} is currently offline. Switched to ${fallback}.`
          );
        } else if (data.defaultModel) {
          setModel(data.defaultModel);
          try {
            localStorage.setItem("poiex-ai-model", data.defaultModel);
          } catch {}
        }
      }
    } catch (err) {
      console.error("Failed to fetch AI models:", err);
    } finally {
      setIsModelLoading(false);
    }
  }, []);

  const handleSyncModels = useCallback(async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (isSyncing) return;
    setIsSyncing(true);
    try {
      const minSpin = new Promise((resolve) => setTimeout(resolve, 600));
      await Promise.all([fetchModels(), minSpin]);
    } catch {
      // Silent update - no popups
    } finally {
      setIsSyncing(false);
    }
  }, [fetchModels, isSyncing]);

  // Switch active chat session
  const handleSelectSession = useCallback(
    async (session: ChatSessionItem) => {
      setActiveSessionId(session.id);
      setActiveSessionTitle(session.title);
      try {
        localStorage.setItem(sessionStorageKey, session.id);
      } catch {}
      setIsLoading(true);
      try {
        const msgs = await getChatSessionMessages(session.id);
        setMessages(
          msgs.map((m) => ({
            id: m.id,
            role: m.role,
            content: m.content,
            timestamp: new Date(m.createdAt),
            type: (m.type as ChatMessage["type"]) || "chat",
            model: m.model || undefined,
            tokens: m.tokens || undefined,
          })),
        );
      } catch {
        toast.error("Failed to load conversation");
      } finally {
        setIsLoading(false);
      }
    },
    [sessionStorageKey],
  );

  // Start a fresh new chat
  const handleNewChat = useCallback(() => {
    setActiveSessionId(null);
    setActiveSessionTitle("New Chat");
    setMessages([]);
    setInput("");
    try {
      localStorage.removeItem(sessionStorageKey);
    } catch {}
  }, [sessionStorageKey]);

  // Fetch all user chat sessions
  const fetchSessions = useCallback(async () => {
    setIsSessionsLoading(true);
    try {
      const list = await getChatSessions(playgroundId);
      setSessions(list);

      // Auto-restore previously active session if saved
      try {
        const savedSessionId = localStorage.getItem(sessionStorageKey);
        if (savedSessionId) {
          const matched = list.find((s) => s.id === savedSessionId);
          if (matched) {
            handleSelectSession(matched);
          }
        }
      } catch {}
    } catch (err) {
      console.error("Failed to fetch sessions:", err);
    } finally {
      setIsSessionsLoading(false);
    }
  }, [playgroundId, sessionStorageKey, handleSelectSession]);

  const hasInitializedRef = useRef(false);

  useEffect(() => {
    let isCancelled = false;
    if (isOpen && !hasInitializedRef.current) {
      hasInitializedRef.current = true;
      Promise.resolve().then(() => {
        if (!isCancelled) {
          fetchModels();
          fetchSessions();
        }
      });
    }
    return () => {
      isCancelled = true;
    };
  }, [isOpen, fetchModels, fetchSessions]);

  // Handle Escape key to close window
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen && !editingSessionId) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose, editingSessionId]);

  // Auto focus inline rename input
  useEffect(() => {
    if (editingSessionId && renameInputRef.current) {
      renameInputRef.current.focus();
      renameInputRef.current.select();
    }
  }, [editingSessionId]);

  const handleModelChange = (newModel: string) => {
    setModel(newModel);
    try {
      localStorage.setItem("poiex-ai-model", newModel);
    } catch {
      // localStorage unavailable
    }
  };

  const scrollToBottom = () => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  };

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      scrollToBottom();
    }, 100);
    return () => clearTimeout(timeoutId);
  }, [messages, isLoading]);

  // Rename session
  const handleStartRename = (session: ChatSessionItem, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingSessionId(session.id);
    setEditingTitle(session.title);
  };

  const handleSaveRename = async (sessionId: string) => {
    const clean = editingTitle.trim();
    setEditingSessionId(null);
    if (!clean) return;

    setSessions((prev) =>
      prev.map((s) => (s.id === sessionId ? { ...s, title: clean } : s)),
    );
    if (activeSessionId === sessionId) {
      setActiveSessionTitle(clean);
    }

    const res = await renameChatSession(sessionId, clean);
    if (res.success) {
      toast.success("Chat renamed");
    } else {
      toast.error(res.error || "Failed to rename chat");
      fetchSessions();
    }
  };

  // Delete session
  const handleDeleteSession = async (
    sessionId: string,
    e: React.MouseEvent,
  ) => {
    e.stopPropagation();
    const remaining = sessions.filter((s) => s.id !== sessionId);
    setSessions(remaining);

    if (activeSessionId === sessionId) {
      if (remaining.length > 0) {
        handleSelectSession(remaining[0]);
      } else {
        handleNewChat();
      }
    }

    const res = await deleteChatSession(sessionId);
    if (res.success) {
      toast.success("Chat deleted");
    } else {
      toast.error(res.error || "Failed to delete chat");
      fetchSessions();
    }
  };

  const getChatModePrompt = (mode: string, content: string) => {
    switch (mode) {
      case "review":
        return `Please review this code and provide detailed suggestions for improvement, including performance, security, and best practices:\n\n**Request:** ${content}`;
      case "fix":
        return `Please help fix issues in this code, including bugs, errors, and potential problems:\n\n**Problem:** ${content}`;
      case "optimize":
        return `Please analyze this code for performance optimizations and suggest improvements:\n\n**Code to optimize:** ${content}`;
      default:
        return content;
    }
  };

  const sendPrompt = useCallback(
    async (textToSend: string) => {
      if (!textToSend.trim() || isLoading) return;

      const messageType =
        chatMode === "chat"
          ? "chat"
          : chatMode === "review"
            ? "code_review"
            : chatMode === "fix"
              ? "error_fix"
              : "optimization";

      const userMessageText = textToSend.trim();
      const newMessage: ChatMessage = {
        role: "user",
        content: userMessageText,
        timestamp: new Date(),
        id: crypto.randomUUID(),
        type: messageType,
      };

      setMessages((prev) => [...prev, newMessage]);
      setInput("");
      if (promptTextareaRef.current) {
        promptTextareaRef.current.style.height = "auto";
      }
      setIsLoading(true);

      try {
        const contextualMessage = getChatModePrompt(chatMode, userMessageText);

        const response = await fetch("/api/chat", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            message: contextualMessage,
            history: messages.slice(-10).map((msg) => ({
              role: msg.role,
              content: msg.content,
            })),
            stream: streamResponse,
            mode: chatMode,
            model,
            sessionId: activeSessionId || undefined,
            playgroundId,
            activeFileName,
            activeFileContent,
          }),
        });

        if (!response.ok) {
          const errData = await response.json().catch(() => ({}));
          if (
            errData.sessionId &&
            (!activeSessionId || activeSessionId !== errData.sessionId)
          ) {
            setActiveSessionId(errData.sessionId);
            if (errData.sessionTitle) {
              setActiveSessionTitle(errData.sessionTitle);
            }
            fetchSessions();
          }
          setMessages((prev) => [
            ...prev,
            {
              role: "assistant",
              content:
                errData.error ||
                "Unable to connect to the AI service. Please verify your connection or model setup and try again.",
              timestamp: new Date(),
              id: crypto.randomUUID(),
              type: "error",
              model,
            },
          ]);
          return;
        }

        const contentType = response.headers.get("content-type") || "";

        // Streaming SSE response branch
        if (contentType.includes("text/event-stream") && response.body) {
          const assistantMessageId = crypto.randomUUID();

          setMessages((prev) => [
            ...prev,
            {
              role: "assistant",
              content: "",
              timestamp: new Date(),
              id: assistantMessageId,
              type: messageType,
              model,
            },
          ]);

          const reader = response.body.getReader();
          const decoder = new TextDecoder();
          const tokenChunks: string[] = [];
          let sseBuffer = "";

          let isStreamDone = false;
          while (true) {
            const { done, value } = await reader.read();
            if (done || isStreamDone) break;

            sseBuffer += decoder.decode(value, { stream: true });
            const lines = sseBuffer.split("\n");
            sseBuffer = lines.pop() || "";

            for (const line of lines) {
              const trimmed = line.trim();
              if (!trimmed.startsWith("data: ")) continue;
              const jsonStr = trimmed.slice(6);
              if (jsonStr === "[DONE]") {
                isStreamDone = true;
                break;
              }

              try {
                const parsed = JSON.parse(jsonStr);

                // Capture created session ID / title (strictly once per stream)
                if (
                  parsed.sessionId &&
                  activeSessionIdRef.current !== parsed.sessionId
                ) {
                  activeSessionIdRef.current = parsed.sessionId;
                  setActiveSessionId(parsed.sessionId);
                  if (parsed.sessionTitle) {
                    setActiveSessionTitle(parsed.sessionTitle);
                  }
                  fetchSessions();
                }

                if (parsed.token) {
                  tokenChunks.push(parsed.token);
                  const fullText = tokenChunks.join("");
                  setMessages((prev) =>
                    prev.map((msg) =>
                      msg.id === assistantMessageId
                        ? {
                            ...msg,
                            content: fullText,
                            model: parsed.model || msg.model,
                          }
                        : msg,
                    ),
                  );
                } else if (parsed.done && parsed.model) {
                  setMessages((prev) =>
                    prev.map((msg) =>
                      msg.id === assistantMessageId
                        ? { ...msg, model: parsed.model }
                        : msg,
                    ),
                  );
                }
              } catch {}
            }
            if (isStreamDone) break;
          }
        } else {
          // Non-streaming JSON response fallback
          const data = await response.json();
          if (
            data.sessionId &&
            (!activeSessionId || activeSessionId !== data.sessionId)
          ) {
            setActiveSessionId(data.sessionId);
            if (data.sessionTitle) {
              setActiveSessionTitle(data.sessionTitle);
            }
            fetchSessions();
          }

          setMessages((prev) => [
            ...prev,
            {
              role: "assistant",
              content: data.response || "No response received.",
              timestamp: new Date(),
              id: crypto.randomUUID(),
              type: messageType,
              model: data.model || model,
              tokens: data.tokens,
            },
          ]);
        }
      } catch {
        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content:
              "Unable to connect to the AI service. Please verify your connection or model setup and try again.",
            timestamp: new Date(),
            id: crypto.randomUUID(),
            type: "error",
            model,
          },
        ]);
      } finally {
        setIsLoading(false);
      }
    },
    [
      isLoading,
      chatMode,
      messages,
      streamResponse,
      model,
      activeSessionId,
      playgroundId,
      fetchSessions,
      activeFileName,
      activeFileContent,
    ],
  );

  const handleSendMessage = (e?: React.SyntheticEvent) => {
    e?.preventDefault();
    sendPrompt(input);
  };

  const handleRetry = (errorIndex: number) => {
    let userText = "";
    let userIndex = -1;
    for (let i = errorIndex - 1; i >= 0; i--) {
      if (messages[i].role === "user") {
        userText = messages[i].content;
        userIndex = i;
        break;
      }
    }
    if (!userText) return;

    setMessages((prev) => prev.filter((_, idx) => idx !== errorIndex && idx !== userIndex));
    sendPrompt(userText);
  };

  const exportChat = () => {
    const chatData = {
      sessionId: activeSessionId,
      title: activeSessionTitle,
      messages,
      timestamp: new Date().toISOString(),
    };
    const blob = new Blob([JSON.stringify(chatData, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `ai-chat-${activeSessionTitle.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${
      new Date().toISOString().split("T")[0]
    }.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  if (isDocked && !isOpen) {
    return null;
  }

  const panelContent = (
    <div className="h-full w-full bg-[#FAFBFC] dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 flex overflow-hidden font-sans transition-colors">
      {/* 1. Left Collapsible History Sidebar */}
      <div
        className={cn(
          "shrink-0 h-full border-r border-zinc-300 dark:border-zinc-800 bg-zinc-50/95 dark:bg-zinc-900/95 flex flex-col transition-all duration-300 ease-in-out select-none",
          isSidebarOpen ? "w-64 sm:w-72" : "w-0 border-r-0 overflow-hidden",
        )}
      >
        {/* Brand Header: Clean Unified PoiEx Identity */}
        <div className="h-13 px-3.5 border-b border-zinc-300 dark:border-zinc-800 bg-zinc-100/80 dark:bg-zinc-900/95 flex items-center justify-between gap-2 shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <Image
              src="/logo.svg"
              alt="PoiEx"
              width={22}
              height={22}
              className="size-5.5 object-contain shrink-0"
              priority
            />
            <span className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 tracking-tight whitespace-nowrap">
              PoiEx DevSpace
            </span>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsSidebarOpen(false)}
            className="h-8 w-8 p-0 text-zinc-500 hover:text-zinc-900 hover:bg-zinc-200/70 dark:text-zinc-400 dark:hover:text-zinc-100 dark:hover:bg-zinc-800 shrink-0"
            title="Collapse sidebar"
          >
            <PanelLeftClose className="h-4 w-4" />
          </Button>
        </div>

        {/* Primary Action: New Chat Button */}
        <div className="p-3 shrink-0">
          <button
            type="button"
            onClick={handleNewChat}
            className="w-full flex items-center justify-between px-3 py-2 rounded-lg bg-white dark:bg-zinc-800/80 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-900 dark:text-zinc-100 text-xs font-medium border border-zinc-300 dark:border-zinc-700/60 transition-colors shadow-xs group"
          >
            <div className="flex items-center gap-2">
              <SquarePen className="h-3.5 w-3.5 text-[#e93f3f] group-hover:scale-110 transition-transform" />
              <span>New chat</span>
            </div>
            <kbd className="text-[10px] text-zinc-600 dark:text-zinc-500 font-mono bg-zinc-100 dark:bg-zinc-900 px-1 py-0.5 rounded border border-zinc-300 dark:border-zinc-800">
              +
            </kbd>
          </button>
        </div>

        {/* Recents List */}
        <div className="flex-1 overflow-y-auto px-2.5 py-1 space-y-1">
          <div className="px-2 py-1 text-[11px] font-semibold text-zinc-500 dark:text-zinc-400 tracking-wider">
            RECENTS
          </div>

          {isSessionsLoading && sessions.length === 0 ? (
            <div className="flex items-center justify-center py-8 text-zinc-500 gap-2 text-xs">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              <span>Loading chats...</span>
            </div>
          ) : sessions.length === 0 ? (
            <div className="px-3 py-6 text-center text-xs text-zinc-500">
              No chat history yet.
            </div>
          ) : (
            sessions.map((session) => {
              const isActive = session.id === activeSessionId;
              const isEditing = session.id === editingSessionId;

              return (
                <div
                  key={session.id}
                  className={cn(
                    "group relative flex items-center justify-between rounded-lg px-2.5 py-2 text-xs cursor-pointer transition-colors duration-150",
                    isActive
                      ? "bg-zinc-200/80 dark:bg-zinc-800 text-zinc-950 dark:text-zinc-100 font-medium shadow-xs"
                      : "text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800/50",
                  )}
                  onClick={() => handleSelectSession(session)}
                >
                  <div className="flex items-center gap-2.5 min-w-0 flex-1">
                    <MessageSquare
                      className={cn(
                        "h-3.5 w-3.5 shrink-0",
                        isActive ? "text-[#e93f3f]" : "text-zinc-500",
                      )}
                    />
                    {isEditing ? (
                      <Input
                        ref={renameInputRef}
                        value={editingTitle}
                        onChange={(e) => setEditingTitle(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.stopPropagation();
                            handleSaveRename(session.id);
                          } else if (e.key === "Escape") {
                            e.stopPropagation();
                            setEditingSessionId(null);
                          }
                        }}
                        onBlur={() => handleSaveRename(session.id)}
                        onClick={(e) => e.stopPropagation()}
                        className="h-6 py-0 px-1.5 text-xs bg-white dark:bg-zinc-950 border-zinc-300 dark:border-zinc-700 text-zinc-900 dark:text-zinc-100 focus-visible:ring-1 focus-visible:ring-[#e93f3f]"
                      />
                    ) : (
                      <span className="truncate">{session.title}</span>
                    )}
                  </div>

                  {!isEditing && (
                    <DropdownMenu>
                      <DropdownMenuTrigger
                        render={
                          <button
                            type="button"
                            onClick={(e) => e.stopPropagation()}
                            className={cn(
                              "h-6 w-6 p-0 rounded flex items-center justify-center text-zinc-500 hover:text-zinc-900 hover:bg-zinc-300/60 dark:text-zinc-400 dark:hover:text-zinc-100 dark:hover:bg-zinc-700/60 transition-opacity shrink-0",
                              isActive
                                ? "opacity-100"
                                : "opacity-0 group-hover:opacity-100",
                            )}
                            title="Chat options"
                          >
                            <MoreHorizontal className="h-3.5 w-3.5" />
                          </button>
                        }
                      />
                      <DropdownMenuContent align="end" className="w-36">
                        <DropdownMenuItem
                          onClick={(e) => handleStartRename(session, e)}
                          className="cursor-pointer gap-2"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                          <span>Rename</span>
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          onClick={(e) => handleDeleteSession(session.id, e)}
                          className="cursor-pointer gap-2 text-red-400 hover:text-red-300 focus:text-red-300"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          <span>Delete</span>
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Sidebar User Account Footer */}
        <div className="p-3 border-t border-zinc-300 dark:border-zinc-800 bg-zinc-100/60 dark:bg-zinc-900/40 shrink-0">
          <div className="flex items-center gap-2.5 px-2 py-1.5 rounded-lg hover:bg-zinc-200/70 dark:hover:bg-zinc-800/60 transition-colors">
            <Avatar className="h-7 w-7 shrink-0 border border-zinc-300 dark:border-zinc-750">
              <AvatarImage
                src={currentUser?.image ?? undefined}
                alt={currentUser?.name ?? "User"}
              />
              <AvatarFallback className="bg-[#e93f3f]/15 text-[#e93f3f] text-xs font-semibold">
                {currentUser?.name ? (
                  currentUser.name.charAt(0).toUpperCase()
                ) : (
                  <User className="h-3.5 w-3.5 text-zinc-400" />
                )}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <span className="text-xs font-medium text-zinc-900 dark:text-zinc-200 truncate block">
                {currentUser?.name || "Account"}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* 2. Main Conversation View */}
      <div className="flex-1 h-full flex flex-col min-w-0 overflow-hidden relative bg-[#FAFBFC] dark:bg-zinc-950">
        {/* Unified Sleek Command Header (52px) */}
        <div className="shrink-0 h-13 border-b border-zinc-300 dark:border-zinc-800 bg-white/95 dark:bg-zinc-900/95 backdrop-blur-md px-4 flex items-center justify-between gap-3 select-none z-10">
          {/* Left: Sidebar Toggle + Title + File Badge */}
          <div className="flex items-center gap-2.5 min-w-0 flex-1">
            {!isSidebarOpen && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsSidebarOpen(true)}
                className="h-8 w-8 p-0 text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:text-zinc-100 dark:hover:bg-zinc-800 shrink-0"
                title="Open history sidebar"
              >
                <PanelLeftOpen className="h-4 w-4" />
              </Button>
            )}

            <div className="min-w-0 flex items-center gap-2">
              <span className="text-xs font-semibold text-zinc-900 dark:text-zinc-100 truncate max-w-45 sm:max-w-70">
                {activeSessionTitle}
              </span>
              {activeFileName && (
                <div
                  className="text-[11px] font-mono font-medium text-zinc-700 dark:text-zinc-200 border border-zinc-300 dark:border-zinc-700 bg-zinc-100/90 dark:bg-zinc-800/90 hover:bg-zinc-200/80 dark:hover:bg-zinc-700/80 px-2 py-0.5 rounded-md flex items-center gap-1.5 shrink-0 transition-colors shadow-2xs max-w-40 truncate"
                  title={activeFileName}
                >
                  <FileCode className="h-3.5 w-3.5 text-zinc-500 dark:text-zinc-400 shrink-0" />
                  <span className="truncate">{activeFileName}</span>
                </div>
              )}
            </div>
          </div>

          {/* Center: Mode Segmented Switcher */}
          <div className="hidden md:flex items-center gap-0.5 border border-zinc-300 dark:border-zinc-800 rounded-lg p-0.5 bg-zinc-100 dark:bg-zinc-950 shrink-0">
            {(
              [
                { id: "chat", label: "Chat" },
                { id: "review", label: "Review" },
                { id: "fix", label: "Fix" },
                { id: "optimize", label: "Optimize" },
              ] as const
            ).map((modeItem) => (
              <button
                key={modeItem.id}
                type="button"
                onClick={() => setChatMode(modeItem.id)}
                className={cn(
                  "px-2.5 py-1 rounded-md text-xs font-medium transition-all duration-150",
                  chatMode === modeItem.id
                    ? "bg-white dark:bg-zinc-800 text-zinc-950 dark:text-zinc-100 shadow-xs border border-zinc-300 dark:border-zinc-700/60 font-semibold"
                    : "text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200",
                )}
              >
                {modeItem.label}
              </button>
            ))}
          </div>

          {/* Right: Model Selector + Tools + Controls */}
          <div className="flex items-center gap-2 shrink-0">
            {/* Custom 2-Line Glassmorphic Model Dropdown Menu */}
            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={isModelLoading}
                    className="h-7 px-2.5 bg-zinc-100 dark:bg-zinc-900/90 hover:bg-zinc-200/80 dark:hover:bg-zinc-800 border-zinc-300 dark:border-zinc-800 rounded-lg text-xs font-medium text-zinc-900 dark:text-zinc-200 flex items-center gap-1.5 shadow-2xs group cursor-pointer"
                    title={`Active Model: ${availableModels.find((m) => m.id === model)?.name || model}`}
                  >
                    <span
                      className={cn(
                        "w-2 h-2 rounded-full shrink-0",
                        availableModels.find((m) => m.id === model)?.isAvailable !== false
                          ? "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.7)]"
                          : "bg-amber-500"
                      )}
                    />
                    <span className="truncate max-w-36 sm:max-w-44 text-[11.5px] font-medium">
                      {availableModels.find((m) => m.id === model)?.name || model}
                    </span>
                    <ChevronDown className="h-3 w-3 text-zinc-400 group-hover:text-zinc-200 transition-transform shrink-0" />
                  </Button>
                }
              />
              <DropdownMenuContent
                align="end"
                className="w-64 p-1 bg-white dark:bg-[#111115] border border-zinc-200 dark:border-zinc-800/80 text-zinc-900 dark:text-zinc-100 shadow-xl rounded-xl font-sans"
              >
                <div className="px-2.5 py-1 text-[10px] uppercase font-mono tracking-wider text-zinc-400 dark:text-zinc-500 font-semibold flex items-center justify-between">
                  <span>Models</span>
                  <button
                    type="button"
                    onPointerDown={(e) => e.stopPropagation()}
                    onClick={handleSyncModels}
                    disabled={isSyncing || isModelLoading}
                    className="hover:text-zinc-700 dark:hover:text-zinc-200 flex items-center gap-1 transition-colors cursor-pointer select-none"
                    title="Refresh model availability"
                  >
                    <RotateCw
                      className={cn(
                        "h-2.5 w-2.5",
                        (isSyncing || isModelLoading) && "animate-spin"
                      )}
                    />
                    <span>Sync</span>
                  </button>
                </div>

                <DropdownMenuSeparator className="my-1 bg-zinc-200 dark:bg-zinc-800/60" />

                {/* Section 1: Google AI Studio */}
                <DropdownMenuGroup>
                  <DropdownMenuLabel className="text-[10px] font-mono uppercase tracking-wider text-zinc-400 dark:text-zinc-500 px-2.5 py-1 font-semibold">
                    Google AI Studio
                  </DropdownMenuLabel>
                  {availableModels
                    .filter((m) => m.provider === "gemini")
                    .map((m) => (
                      <DropdownMenuItem
                        key={m.id}
                        onClick={() => handleModelChange(m.id)}
                        disabled={m.isAvailable === false}
                        className={cn(
                          "flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs cursor-pointer transition-colors duration-100",
                          model === m.id
                            ? "bg-zinc-100 dark:bg-zinc-800/90 text-zinc-950 dark:text-zinc-50 font-medium"
                            : "text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100/70 dark:hover:bg-zinc-800/50",
                          m.isAvailable === false && "opacity-50 cursor-not-allowed"
                        )}
                      >
                        <div className="flex items-center gap-2">
                          <span>{m.name}</span>
                          {m.recommended && (
                            <span className="text-[9px] px-1 py-0.2 bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 rounded border border-zinc-200 dark:border-zinc-700 font-mono">
                              Default
                            </span>
                          )}
                        </div>
                        {model === m.id && <Check className="h-3.5 w-3.5 text-zinc-900 dark:text-zinc-100 shrink-0" />}
                      </DropdownMenuItem>
                    ))}
                </DropdownMenuGroup>

                <DropdownMenuSeparator className="my-1 bg-zinc-200 dark:bg-zinc-800/60" />

                {/* Section 2: Groq Cloud */}
                <DropdownMenuGroup>
                  <DropdownMenuLabel className="text-[10px] font-mono uppercase tracking-wider text-zinc-400 dark:text-zinc-500 px-2.5 py-1 font-semibold">
                    Groq Cloud
                  </DropdownMenuLabel>
                  {availableModels
                    .filter((m) => m.provider === "groq")
                    .map((m) => (
                      <DropdownMenuItem
                        key={m.id}
                        onClick={() => handleModelChange(m.id)}
                        disabled={m.isAvailable === false}
                        className={cn(
                          "flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs cursor-pointer transition-colors duration-100",
                          model === m.id
                            ? "bg-zinc-100 dark:bg-zinc-800/90 text-zinc-950 dark:text-zinc-50 font-medium"
                            : "text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100/70 dark:hover:bg-zinc-800/50",
                          m.isAvailable === false && "opacity-50 cursor-not-allowed"
                        )}
                      >
                        <span>{m.name}</span>
                        {model === m.id && <Check className="h-3.5 w-3.5 text-zinc-900 dark:text-zinc-100 shrink-0" />}
                      </DropdownMenuItem>
                    ))}
                </DropdownMenuGroup>

                <DropdownMenuSeparator className="my-1 bg-zinc-200 dark:bg-zinc-800/60" />

                {/* Section 3: Fallback & Local */}
                <DropdownMenuGroup>
                  <DropdownMenuLabel className="text-[10px] font-mono uppercase tracking-wider text-zinc-400 dark:text-zinc-500 px-2.5 py-1 font-semibold">
                    Fallback & Local
                  </DropdownMenuLabel>
                  {availableModels
                    .filter((m) => m.provider === "openrouter" || m.provider === "local")
                    .map((m) => (
                      <DropdownMenuItem
                        key={m.id}
                        onClick={() => handleModelChange(m.id)}
                        disabled={m.isAvailable === false}
                        className={cn(
                          "flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs cursor-pointer transition-colors duration-100",
                          model === m.id
                            ? "bg-zinc-100 dark:bg-zinc-800/90 text-zinc-950 dark:text-zinc-50 font-medium"
                            : "text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100/70 dark:hover:bg-zinc-800/50",
                          m.isAvailable === false && "opacity-50 cursor-not-allowed"
                        )}
                      >
                        <div className="flex items-center gap-1.5">
                          <span>{m.name}</span>
                          {m.provider === "local" && m.isAvailable === false && (
                            <span className="text-[10px] text-zinc-400 dark:text-zinc-500 font-mono">(Offline)</span>
                          )}
                        </div>
                        {model === m.id && <Check className="h-3.5 w-3.5 text-zinc-900 dark:text-zinc-100 shrink-0" />}
                      </DropdownMenuItem>
                    ))}
                </DropdownMenuGroup>
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Settings Dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 p-0 text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:text-zinc-100 dark:hover:bg-zinc-800"
                    title="Chat settings"
                  >
                    <Settings className="h-4 w-4" />
                  </Button>
                }
              />
              <DropdownMenuContent
                align="end"
                className="w-64 p-1.5 bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-800 text-zinc-900 dark:text-zinc-100 shadow-xl rounded-xl font-sans"
              >
                <DropdownMenuGroup>
                  <DropdownMenuCheckboxItem
                    checked={autoSave}
                    onCheckedChange={setAutoSave}
                    className="cursor-pointer text-xs py-2 px-2.5 rounded-lg text-zinc-700 dark:text-zinc-200 focus:bg-zinc-100 dark:focus:bg-zinc-800 focus:text-zinc-950 dark:focus:text-zinc-100 transition-colors"
                  >
                    Auto-save conversations
                  </DropdownMenuCheckboxItem>
                  <DropdownMenuCheckboxItem
                    checked={streamResponse}
                    onCheckedChange={setStreamResponse}
                    className="cursor-pointer text-xs py-2 px-2.5 rounded-lg text-zinc-700 dark:text-zinc-200 focus:bg-zinc-100 dark:focus:bg-zinc-800 focus:text-zinc-950 dark:focus:text-zinc-100 transition-colors"
                  >
                    Stream responses
                  </DropdownMenuCheckboxItem>
                </DropdownMenuGroup>

                <DropdownMenuSeparator className="my-1.5 bg-zinc-200 dark:bg-zinc-800" />

                <DropdownMenuGroup>
                  <DropdownMenuLabel className="px-2.5 py-1 text-[10px] font-semibold text-zinc-500 dark:text-zinc-400 tracking-wider uppercase font-mono">
                    Actions
                  </DropdownMenuLabel>
                  <DropdownMenuItem
                    onClick={exportChat}
                    className="cursor-pointer text-xs py-2 px-2.5 rounded-lg text-zinc-700 dark:text-zinc-300 hover:text-zinc-950 dark:hover:text-zinc-100 focus:bg-zinc-100 dark:focus:bg-zinc-800 focus:text-zinc-950 dark:focus:text-zinc-100 flex items-center gap-2.5 transition-colors"
                  >
                    <Download className="h-3.5 w-3.5 text-zinc-400" />
                    <span>Export chat history</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => setMessages([])}
                    className="cursor-pointer text-xs py-2 px-2.5 rounded-lg text-red-400 hover:text-red-300 focus:bg-red-950/30 focus:text-red-300 flex items-center gap-2.5 transition-colors"
                  >
                    <Trash2 className="h-3.5 w-3.5 text-red-400" />
                    <span>Clear current view</span>
                  </DropdownMenuItem>
                </DropdownMenuGroup>
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Close Window */}
            <Button
              variant="ghost"
              size="sm"
              onClick={onClose}
              className="h-8 w-8 p-0 text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:text-zinc-100 dark:hover:bg-zinc-800"
              title="Close chat window (Esc)"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Full-Height Messages Canvas (Gemini style) */}
        <div className="flex-1 min-h-0 overflow-y-auto">
          <div className="w-full max-w-4xl mx-auto px-4 sm:px-6 py-4 space-y-6">
            {/* Clean Developer Hero (NO cheesy brain icon) */}
            {messages.length === 0 && !isLoading && (
              <div className="text-center text-zinc-500 py-16 flex flex-col items-center">
                <h3 className="text-lg font-semibold mb-1 text-zinc-900 dark:text-zinc-100 tracking-tight">
                  What should we build today?
                </h3>
                <p className="text-xs text-zinc-600 dark:text-zinc-400 max-w-md mb-8 leading-relaxed">
                  Pair program, review code diffs, debug runtime errors, or
                  implement full features.
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 w-full max-w-lg">
                  {[
                    {
                      icon: FileCode,
                      title: "Explain active file structure",
                      prompt:
                        "Explain the active file structure and exported components",
                    },
                    {
                      icon: ShieldCheck,
                      title: "Review code for edge cases",
                      prompt:
                        "Review the active code for edge cases and potential bugs",
                    },
                    {
                      icon: Zap,
                      title: "Optimize performance and complexity",
                      prompt:
                        "Analyze and optimize performance bottlenecks in this module",
                    },
                    {
                      icon: Sparkles,
                      title: "Add error handling and typing",
                      prompt:
                        "Add comprehensive error handling and strict TypeScript types",
                    },
                  ].map((item) => {
                    const ItemIcon = item.icon;
                    return (
                      <button
                        key={item.title}
                        type="button"
                        onClick={() => {
                          setInput(item.prompt);
                          if (promptTextareaRef.current) {
                            promptTextareaRef.current.focus();
                            promptTextareaRef.current.style.height = "auto";
                          }
                        }}
                        className="flex items-center gap-3 p-3 bg-white dark:bg-zinc-900/80 hover:bg-zinc-100/80 dark:hover:bg-zinc-800 border border-zinc-300 dark:border-zinc-800/80 hover:border-zinc-400 dark:hover:border-zinc-700/80 rounded-xl text-xs text-zinc-800 dark:text-zinc-300 transition-colors text-left shadow-xs group"
                      >
                        <ItemIcon className="h-4 w-4 text-zinc-500 dark:text-zinc-400 group-hover:text-[#e93f3f] transition-colors shrink-0" />
                        <span className="truncate">{item.title}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {messages.map((msg, index) => {
              const isError =
                msg.type === "error" ||
                msg.content.includes("Failed to generate AI response") ||
                msg.content.includes("Unable to connect") ||
                msg.content.includes("service is temporarily unavailable") ||
                msg.content.includes("service is currently unavailable");

              return (
                <div
                  key={msg.id}
                  className={cn(
                    "flex gap-3 group w-full",
                    msg.role === "user" ? "justify-end" : "justify-start",
                  )}
                >
                  {msg.role === "user" ? (
                    <div className="flex items-start gap-2.5 justify-end max-w-[85%] sm:max-w-[75%] ml-auto">
                      <div className="flex flex-col items-end gap-1 min-w-0">
                        <div className="bg-zinc-100 dark:bg-zinc-800/90 text-zinc-900 dark:text-zinc-100 px-4 py-2.5 rounded-2xl rounded-tr-xs border border-zinc-200 dark:border-zinc-700/60 shadow-xs text-sm leading-relaxed whitespace-pre-wrap font-sans wrap-break-word">
                          {msg.content}
                        </div>
                        <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity text-[10px] text-zinc-500 font-mono pr-1">
                          <span>
                            {msg.timestamp.toLocaleTimeString([], {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </span>
                          <button
                            type="button"
                            onClick={() =>
                              navigator.clipboard.writeText(msg.content)
                            }
                            className="hover:text-zinc-800 dark:hover:text-zinc-300 transition-colors p-0.5"
                            title="Copy prompt"
                          >
                            <Copy className="h-2.5 w-2.5" />
                          </button>
                        </div>
                      </div>

                      <Avatar className="h-7 w-7 shrink-0 border border-zinc-300 dark:border-zinc-700/80 mt-0.5">
                        <AvatarImage
                          src={currentUser?.image ?? undefined}
                          alt={currentUser?.name ?? "User"}
                        />
                        <AvatarFallback className="bg-[#e93f3f]/15 text-[#e93f3f] text-xs font-semibold">
                          {currentUser?.name ? (
                            currentUser.name.charAt(0).toUpperCase()
                          ) : (
                            <User className="h-3.5 w-3.5 text-zinc-400" />
                          )}
                        </AvatarFallback>
                      </Avatar>
                    </div>
                  ) : (
                    <div className="flex items-start gap-3 justify-start w-full">
                      <div className="w-7 h-7 rounded-lg border border-zinc-300 dark:border-zinc-800 bg-white dark:bg-zinc-900/90 flex items-center justify-center shrink-0 shadow-xs mt-0.5">
                        <Image
                          src="/logo.svg"
                          alt="PoiEx AI"
                          width={16}
                          height={16}
                        />
                      </div>

                      <div className="flex flex-col gap-1 min-w-0 flex-1">
                        {isError ? (
                          <div className="rounded-xl border border-rose-200 dark:border-rose-900/50 bg-rose-50/90 dark:bg-rose-950/30 px-4 py-3 text-xs shadow-xs space-y-2 max-w-md transition-colors">
                            <div className="flex items-center justify-between gap-2">
                              <div className="flex items-center gap-1.5 text-rose-700 dark:text-rose-400 font-semibold">
                                <AlertCircle className="h-4 w-4 shrink-0 text-rose-600 dark:text-rose-400" />
                                <span>Service Unavailable</span>
                              </div>
                              <Button
                                type="button"
                                size="sm"
                                onClick={() => handleRetry(index)}
                                disabled={isLoading}
                                className="h-6 px-2.5 text-[11px] font-medium bg-rose-600 hover:bg-rose-700 dark:bg-rose-600 dark:hover:bg-rose-500 text-white border-0 rounded-md flex items-center gap-1 transition-colors shadow-xs"
                              >
                                <RotateCw
                                  className={cn(
                                    "h-3 w-3",
                                    isLoading && "animate-spin",
                                  )}
                                />
                                <span>Retry</span>
                              </Button>
                            </div>
                            <p className="text-rose-900 dark:text-rose-200 text-xs leading-relaxed font-normal">
                              {msg.content}
                            </p>
                          </div>
                        ) : (
                          <div className="w-full text-zinc-900 dark:text-zinc-100 space-y-2">
                            <MessageTypeIndicator
                              type={msg.type}
                              model={msg.model}
                              tokens={msg.tokens}
                            />

                            <div className="prose dark:prose-invert prose-base max-w-none leading-relaxed text-zinc-800 dark:text-zinc-200 text-sm sm:text-[15px]">
                              <ReactMarkdown
                                remarkPlugins={[remarkGfm, remarkMath]}
                                rehypePlugins={[rehypeKatex]}
                                components={{
                                  code({
                                    className,
                                    children,
                                    ...props
                                  }: React.ComponentPropsWithoutRef<"code">) {
                                    const match = /language-(\w+)/.exec(
                                      className || "",
                                    );
                                    const codeText = String(children).replace(
                                      /\n$/,
                                      "",
                                    );
                                    return match ? (
                                      <CodeBlockItem
                                        language={match[1]}
                                        code={codeText}
                                        onApplyCode={onApplyCode}
                                        onReviewDiff={onReviewDiff}
                                        activeFileName={activeFileName}
                                      />
                                    ) : (
                                      <code
                                        className="bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700/60 px-1.5 py-0.5 rounded text-xs font-mono text-zinc-800 dark:text-zinc-200"
                                        {...props}
                                      >
                                        {children}
                                      </code>
                                    );
                                  },
                                }}
                              >
                                {msg.content}
                              </ReactMarkdown>
                            </div>

                            <div className="flex items-center justify-between mt-2.5 pt-2 text-[10px] text-zinc-500 font-mono">
                              <div className="flex items-center gap-2">
                                <span>
                                  {msg.timestamp.toLocaleTimeString([], {
                                    hour: "2-digit",
                                    minute: "2-digit",
                                  })}
                                </span>
                                {msg.model && (
                                  <span className="bg-zinc-100 dark:bg-zinc-800/60 px-1.5 py-0.5 rounded text-zinc-600 dark:text-zinc-400 border border-zinc-300 dark:border-zinc-800">
                                    {msg.model}
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() =>
                                    navigator.clipboard.writeText(msg.content)
                                  }
                                  className="h-6 w-6 p-0 text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-200"
                                  title="Copy message"
                                >
                                  <Copy className="h-3 w-3" />
                                </Button>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}

            {isLoading && (
              <div className="flex items-start gap-4 justify-start">
                <div className="w-7 h-7 rounded-lg border border-zinc-300 dark:border-zinc-800 bg-white dark:bg-zinc-900 flex items-center justify-center shrink-0 shadow-xs mt-0.5">
                  <Image
                    src="/logo.svg"
                    alt="PoiEx AI"
                    width={16}
                    height={16}
                  />
                </div>
                <div className="bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-800 p-4 rounded-2xl rounded-bl-sm flex items-center gap-3 shadow-xs">
                  <Loader2 className="h-4 w-4 animate-spin text-[#e93f3f]" />
                  <span className="text-xs text-zinc-700 dark:text-zinc-300">
                    {chatMode === "review"
                      ? "Analyzing code structure and edge cases..."
                      : chatMode === "fix"
                        ? "Tracing bug root cause and preparing fix..."
                        : chatMode === "optimize"
                          ? "Profiling performance bottlenecks..."
                          : "Generating response..."}
                  </span>
                </div>
              </div>
            )}

            {/* Explicit bottom spacer so the latest response and action buttons always scroll completely into view above the floating input */}
            <div className="h-28 sm:h-32 shrink-0" aria-hidden="true" />
            <div ref={messagesEndRef} className="h-px" />
          </div>
        </div>

        {/* 3. Floating Prompt Dock (Oval pill shape, sleek & responsive) */}
        <div className="absolute bottom-0 left-0 right-0 z-20 pointer-events-none px-4 sm:px-6 pb-3 pt-6 bg-gradient-to-t from-[#FAFBFC] via-[#FAFBFC]/90 to-transparent dark:from-zinc-950 dark:via-zinc-950/90 dark:to-transparent">
          <div className="w-full max-w-4xl mx-auto pointer-events-auto">
            <form
              onSubmit={handleSendMessage}
              className="relative rounded-full border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#121216] shadow-lg pl-5 pr-2.5 py-1.5 sm:pl-6 sm:pr-3 sm:py-2 flex items-center gap-2 transition-all focus-within:border-zinc-400 dark:focus-within:border-zinc-600 focus-within:ring-1 focus-within:ring-zinc-400/20"
            >
              <textarea
                ref={promptTextareaRef}
                placeholder={
                  chatMode === "chat"
                    ? "Ask PoiEx assistant or describe what to implement..."
                    : chatMode === "review"
                      ? "Describe what to review..."
                      : chatMode === "fix"
                        ? "Describe what bug to fix..."
                        : "Describe what to optimize..."
                }
                value={input}
                onChange={handleTextareaInput}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleSendMessage();
                  }
                }}
                disabled={isLoading}
                rows={1}
                className="w-full bg-transparent border-0 text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 dark:placeholder:text-zinc-500 text-sm leading-relaxed px-1 py-1.5 resize-none outline-none focus:outline-none focus:ring-0 min-h-[38px] max-h-28 scrollbar-thin"
              />

              <Button
                type="submit"
                disabled={isLoading || !input.trim()}
                size="icon"
                className={cn(
                  "h-8 w-8 rounded-full transition-all duration-150 shrink-0",
                  input.trim() && !isLoading
                    ? "bg-[#e93f3f] hover:bg-[#d43535] text-white shadow-xs hover:scale-105 active:scale-95"
                    : "bg-zinc-100 dark:bg-zinc-800/80 text-zinc-400 dark:text-zinc-500 border border-zinc-200 dark:border-zinc-700/60 cursor-not-allowed",
                )}
                title="Send message (Enter)"
              >
                {isLoading ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin text-zinc-300" />
                ) : (
                  <ArrowUp className="h-4 w-4 stroke-[2.5]" />
                )}
              </Button>
            </form>
            <p className="text-center mt-1.5 text-[10.5px] text-zinc-400 dark:text-zinc-500 font-sans select-none">
              PoiEx AI can make mistakes. Verify generated info.
            </p>
          </div>
        </div>
      </div>
    </div>
  );

  if (isDocked) {
    return <TooltipProvider>{panelContent}</TooltipProvider>;
  }

  return (
    <TooltipProvider>
      <>
        <div
          className={cn(
            "fixed inset-0 bg-black/75 backdrop-blur-xs z-50 transition-opacity duration-300",
            isOpen ? "opacity-100" : "opacity-0 pointer-events-none",
          )}
          onClick={() => {
            if (!isFullScreen && !editingSessionId) onClose();
          }}
        />
        <div
          className={cn(
            "fixed z-50 flex flex-col transition-all duration-300 ease-out font-sans",
            isFullScreen
              ? "inset-0 w-full h-full bg-[#FAFBFC] dark:bg-zinc-950"
              : "inset-4 sm:inset-8 md:inset-12 max-w-5xl max-h-[85vh] m-auto w-full h-full bg-[#FAFBFC] dark:bg-zinc-950 rounded-2xl border border-zinc-300 dark:border-zinc-800 shadow-[0_25px_60px_-15px_rgba(0,0,0,0.25)] dark:shadow-[0_25px_60px_-15px_rgba(0,0,0,0.85)] overflow-hidden",
            isOpen
              ? "scale-100 opacity-100 pointer-events-auto"
              : "scale-95 opacity-0 pointer-events-none",
          )}
        >
          {panelContent}
        </div>
      </>
    </TooltipProvider>
  );
};
