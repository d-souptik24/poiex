"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import { signIn } from "next-auth/react";
import { FaGithub } from "react-icons/fa";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ActionTooltip } from "@/components/ui/action-tooltip";
import {
    Loader2,
    GitBranch,
    GitFork,
    Lock,
    Globe,
    Star,
    Search,
    ArrowRight,
    AlertCircle,
    FolderGit2,
    RotateCw,
} from "lucide-react";
import { parseGitHubUrl } from "../lib/github";
import { getUserGithubRepos, type UserGitHubRepo } from "../actions";

interface ImportRepoModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSubmit: (data: {
        repoUrl: string;
        branch?: string;
        title?: string;
    }) => Promise<void>;
}

function getLanguageColor(language: string | null): string {
    switch (language?.toLowerCase()) {
        case "typescript":
            return "#3178c6";
        case "javascript":
            return "#f7df1e";
        case "python":
            return "#3572A5";
        case "html":
            return "#e34c26";
        case "css":
            return "#563d7c";
        case "rust":
            return "#dea584";
        case "go":
            return "#00ADD8";
        default:
            return "#8b949e";
    }
}

export default function ImportRepoModal({
    isOpen,
    onClose,
    onSubmit,
}: ImportRepoModalProps) {
    const [activeTab, setActiveTab] = useState<string>("my-repos");
    const [repoUrl, setRepoUrl] = useState("");
    const [branch, setBranch] = useState("");
    const [title, setTitle] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [importingRepo, setImportingRepo] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);

    // Personal repositories state
    const [repos, setRepos] = useState<UserGitHubRepo[]>([]);
    const [isFetchingRepos, setIsFetchingRepos] = useState(false);
    const [isConnected, setIsConnected] = useState(true);
    const [isLinked, setIsLinked] = useState(true);
    const [searchQuery, setSearchQuery] = useState("");
    const [filterType, setFilterType] = useState<"all" | "personal" | "forks">("all");

    const fetchUserRepos = useCallback(async () => {
        setIsFetchingRepos(true);
        setError(null);
        try {
            const res = await getUserGithubRepos();
            setIsConnected(res.isConnected);
            setIsLinked(Boolean(res.linked));
            setRepos(res.repos || []);
            if (res.error && res.isConnected) {
                setError(res.error);
            }
        } catch {
            setIsConnected(false);
            setIsLinked(false);
        } finally {
            setIsFetchingRepos(false);
        }
    }, []);

    useEffect(() => {
        if (!isOpen) return;

        let active = true;
        Promise.resolve().then(async () => {
            if (!active) return;
            setIsFetchingRepos(true);
            setError(null);
            try {
                const res = await getUserGithubRepos();
                if (!active) return;
                setIsConnected(res.isConnected);
                setIsLinked(Boolean(res.linked));
                setRepos(res.repos || []);
                if (res.error && res.isConnected) {
                    setError(res.error);
                }
            } catch {
                if (!active) return;
                setIsConnected(false);
                setIsLinked(false);
            } finally {
                if (active) {
                    setIsFetchingRepos(false);
                }
            }
        });

        return () => {
            active = false;
        };
    }, [isOpen]);

    const handleClose = () => {
        if (isLoading) return;
        setError(null);
        setRepoUrl("");
        setBranch("");
        setTitle("");
        setSearchQuery("");
        setImportingRepo(null);
        onClose();
    };

    // Filter personal repos
    const filteredRepos = useMemo(() => {
        return repos.filter((repo) => {
            if (filterType === "personal" && repo.isFork) return false;
            if (filterType === "forks" && !repo.isFork) return false;

            if (!searchQuery.trim()) return true;
            const q = searchQuery.toLowerCase();
            return (
                repo.name.toLowerCase().includes(q) ||
                repo.fullName.toLowerCase().includes(q) ||
                (repo.description && repo.description.toLowerCase().includes(q)) ||
                (repo.language && repo.language.toLowerCase().includes(q))
            );
        });
    }, [repos, filterType, searchQuery]);

    const handleImportPersonalRepo = async (repo: UserGitHubRepo) => {
        setError(null);
        setImportingRepo(repo.fullName);
        setIsLoading(true);

        try {
            await onSubmit({
                repoUrl: repo.fullName,
                branch: repo.defaultBranch,
                title: repo.name,
            });
            handleClose();
        } catch (err) {
            const message = err instanceof Error ? err.message : "Failed to import repository.";
            setError(message);
        } finally {
            setIsLoading(false);
            setImportingRepo(null);
        }
    };

    const handleManualSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);

        const trimmedUrl = repoUrl.trim();
        if (!trimmedUrl) {
            setError("Please enter a GitHub repository URL or shorthand (owner/repo).");
            return;
        }

        const parsed = parseGitHubUrl(trimmedUrl);
        if (!parsed) {
            setError("Invalid GitHub repository format. Use 'https://github.com/owner/repo'");
            return;
        }

        try {
            setIsLoading(true);
            await onSubmit({
                repoUrl: trimmedUrl,
                branch: branch.trim() || undefined,
                title: title.trim() || undefined,
            });
            handleClose();
        } catch (err) {
            const message = err instanceof Error ? err.message : "Failed to import repository.";
            setError(message);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <Dialog
            open={isOpen}
            onOpenChange={(open) => {
                if (!open) handleClose();
            }}
        >
            <DialogContent className="sm:max-w-[620px] p-6 max-h-[85vh] flex flex-col">
                <DialogHeader className="gap-1 shrink-0">
                    <DialogTitle className="text-xl font-semibold text-zinc-100 flex items-center gap-2.5">
                        <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-zinc-800 border border-zinc-700/60 text-zinc-300">
                            <FolderGit2 size={18} />
                        </div>
                        Import Git Repository
                    </DialogTitle>
                    <DialogDescription className="text-zinc-400 text-xs sm:text-sm">
                        Import your personal or forked repositories directly into the in-memory WebContainer workspace.
                    </DialogDescription>
                </DialogHeader>

                {error && (
                    <div className="flex items-start gap-2.5 p-3 rounded-md bg-destructive/10 border border-destructive/20 text-destructive text-sm my-2 shrink-0">
                        <AlertCircle size={18} className="mt-0.5 shrink-0" />
                        <span className="leading-snug">{error}</span>
                    </div>
                )}

                <Tabs
                    value={activeTab}
                    onValueChange={setActiveTab}
                    className="flex flex-col flex-1 min-h-0 mt-2"
                >
                    <TabsList className="grid w-full grid-cols-2 mb-4 shrink-0">
                        <TabsTrigger value="my-repos" className="text-xs sm:text-sm">
                            Your Repositories {repos.length > 0 && `(${repos.length})`}
                        </TabsTrigger>
                        <TabsTrigger value="url" className="text-xs sm:text-sm">
                            Public URL / Shorthand
                        </TabsTrigger>
                    </TabsList>

                    {/* Tab 1: Personal Repositories List */}
                    <TabsContent value="my-repos" className="flex flex-col flex-1 min-h-[320px] justify-between space-y-3">
                        {isConnected && (
                            <div className="flex items-center gap-2 shrink-0">
                                <div className="relative flex-1">
                                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                                    <Input
                                        placeholder="Search repositories by name, language..."
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                        className="pl-8 h-8 text-xs bg-muted/30"
                                    />
                                </div>
                                <div className="flex items-center gap-1 border rounded-md p-0.5 bg-muted/20 text-xs shrink-0">
                                    <button
                                        type="button"
                                        onClick={() => setFilterType("all")}
                                        className={`px-2 py-1 rounded text-xs transition-colors ${
                                            filterType === "all"
                                                ? "bg-background text-foreground shadow-xs font-medium"
                                                : "text-muted-foreground hover:text-foreground"
                                        }`}
                                    >
                                        All
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setFilterType("personal")}
                                        className={`px-2 py-1 rounded text-xs transition-colors ${
                                            filterType === "personal"
                                                ? "bg-background text-foreground shadow-xs font-medium"
                                                : "text-muted-foreground hover:text-foreground"
                                        }`}
                                    >
                                        Personal
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setFilterType("forks")}
                                        className={`px-2 py-1 rounded text-xs transition-colors ${
                                            filterType === "forks"
                                                ? "bg-background text-foreground shadow-xs font-medium"
                                                : "text-muted-foreground hover:text-foreground"
                                        }`}
                                    >
                                        Forks
                                    </button>
                                </div>
                                <ActionTooltip label="Refresh repositories">
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        onClick={fetchUserRepos}
                                        disabled={isFetchingRepos}
                                        className="h-8 w-8 text-muted-foreground hover:text-foreground shrink-0"
                                    >
                                        <RotateCw className={`h-3.5 w-3.5 ${isFetchingRepos ? "animate-spin" : ""}`} />
                                    </Button>
                                </ActionTooltip>
                            </div>
                        )}

                        {/* Repositories Scrollable List */}
                        <div className="flex-1 overflow-y-auto pr-1 space-y-2 min-h-[220px] max-h-[340px]">
                            {isFetchingRepos ? (
                                <div className="flex flex-col items-center justify-center h-48 gap-3 text-muted-foreground">
                                    <Loader2 className="h-6 w-6 animate-spin text-[#e93f3f]" />
                                    <span className="text-xs">Connecting to GitHub...</span>
                                </div>
                            ) : !isConnected ? (
                                <div className="flex flex-col items-center justify-center h-52 gap-3 text-center p-4 border rounded-lg bg-muted/20">
                                    <FolderGit2 className="h-8 w-8 text-muted-foreground" />
                                    <div className="space-y-1">
                                        <p className="text-sm font-medium text-foreground">
                                            {isLinked ? "GitHub Session Expired" : "GitHub Account Not Linked"}
                                        </p>
                                        <p className="text-xs text-muted-foreground max-w-sm">
                                            {isLinked
                                                ? "Your GitHub access token has expired or is invalid. Please reconnect your account to view your repositories."
                                                : "Sign in with GitHub or link your account to view your personal and forked repositories. You can still import any public repository via URL."}
                                        </p>
                                    </div>
                                    <div className="flex items-center gap-2 mt-1">
                                        <Button
                                            size="sm"
                                            onClick={() => signIn("github", { callbackUrl: "/dashboard" })}
                                            className="text-xs bg-[#24292e] hover:bg-[#1b1f23] text-white dark:bg-zinc-100 dark:hover:bg-white dark:text-zinc-900 gap-1.5"
                                        >
                                            <FaGithub className="h-3.5 w-3.5" />
                                            {isLinked ? "Reconnect GitHub" : "Connect GitHub"}
                                        </Button>
                                        <Button
                                            size="sm"
                                            variant="outline"
                                            onClick={() => setActiveTab("url")}
                                            className="text-xs"
                                        >
                                            Use Public URL Instead
                                        </Button>
                                    </div>
                                </div>
                            ) : filteredRepos.length === 0 ? (
                                <div className="flex flex-col items-center justify-center h-48 gap-2 text-center text-muted-foreground">
                                    <p className="text-sm font-medium">No repositories found</p>
                                    <p className="text-xs">
                                        {searchQuery ? `No matches for "${searchQuery}"` : "No repositories found under this filter."}
                                    </p>
                                </div>
                            ) : (
                                filteredRepos.map((repo) => (
                                    <div
                                        key={repo.id}
                                        className="flex items-center justify-between p-3 rounded-lg border border-border/80 bg-muted/20 hover:bg-muted/50 hover:border-border transition-all duration-150 gap-3"
                                    >
                                        <div className="flex-1 min-w-0 space-y-1">
                                            <div className="flex items-center gap-2 flex-wrap">
                                                <span className="text-sm font-semibold text-foreground truncate">
                                                    {repo.name}
                                                </span>
                                                {repo.isPrivate ? (
                                                    <Badge
                                                        variant="outline"
                                                        className="text-amber-500 border-amber-500/30 gap-1 text-[10px] py-0 h-4"
                                                    >
                                                        <Lock size={9} /> Private
                                                    </Badge>
                                                ) : (
                                                    <Badge
                                                        variant="outline"
                                                        className="text-muted-foreground border-border gap-1 text-[10px] py-0 h-4"
                                                    >
                                                        <Globe size={9} /> Public
                                                    </Badge>
                                                )}
                                                {repo.isFork && (
                                                    <Badge
                                                        variant="outline"
                                                        className="text-muted-foreground border-border gap-1 text-[10px] py-0 h-4"
                                                    >
                                                        <GitFork size={9} /> Fork
                                                    </Badge>
                                                )}
                                            </div>

                                            {repo.description && (
                                                <p className="text-xs text-muted-foreground truncate max-w-md">
                                                    {repo.description}
                                                </p>
                                            )}

                                            <div className="flex items-center gap-3 text-[11px] text-muted-foreground pt-0.5">
                                                {repo.language && (
                                                    <span className="flex items-center gap-1.5">
                                                        <span
                                                            className="w-2 h-2 rounded-full shrink-0"
                                                            style={{
                                                                backgroundColor: getLanguageColor(repo.language),
                                                            }}
                                                        />
                                                        {repo.language}
                                                    </span>
                                                )}
                                                {repo.stars > 0 && (
                                                    <span className="flex items-center gap-1">
                                                        <Star size={11} className="text-amber-400 fill-amber-400" />
                                                        {repo.stars}
                                                    </span>
                                                )}
                                                <span className="flex items-center gap-1">
                                                    <GitBranch size={11} />
                                                    {repo.defaultBranch}
                                                </span>
                                            </div>
                                        </div>

                                        <Button
                                            size="sm"
                                            className="bg-[#e93f3f] hover:bg-[#d43535] text-white shrink-0 h-8 px-3 text-xs"
                                            disabled={isLoading}
                                            onClick={() => handleImportPersonalRepo(repo)}
                                        >
                                            {importingRepo === repo.fullName ? (
                                                <>
                                                    <Loader2 size={13} className="animate-spin mr-1.5" />
                                                    <span>Importing...</span>
                                                </>
                                            ) : (
                                                <span>Import</span>
                                            )}
                                        </Button>
                                    </div>
                                ))
                            )}
                        </div>

                        <div className="rounded-md bg-muted/40 p-2.5 text-[11px] text-muted-foreground border shrink-0">
                            <span>WebContainer Notice: Repositories with a root <code className="text-foreground">package.json</code> boot automatically. Non-Node repositories run in Editor mode.</span>
                        </div>
                    </TabsContent>

                    {/* Tab 2: Manual Public URL Fallback */}
                    <TabsContent value="url" className="flex flex-col flex-1 min-h-[320px] justify-between">
                        <form onSubmit={handleManualSubmit} className="space-y-4 pt-1 flex flex-col flex-1 justify-between">
                            <div className="space-y-4">
                                <div className="grid gap-2">
                                    <Label htmlFor="repo-url" className="text-sm font-medium">
                                        GitHub Repository URL <span className="text-[#e93f3f]">*</span>
                                    </Label>
                                    <Input
                                        id="repo-url"
                                        placeholder="https://github.com/owner/repo"
                                        value={repoUrl}
                                        onChange={(e) => {
                                            setRepoUrl(e.target.value);
                                            if (error) setError(null);
                                        }}
                                        disabled={isLoading}
                                        autoFocus
                                    />
                                    <p className="text-xs text-muted-foreground">
                                        Example: <code className="text-foreground">honojs/hono</code> or full GitHub repository link
                                    </p>
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <div className="grid gap-2">
                                        <Label htmlFor="branch" className="text-sm font-medium flex items-center gap-1.5">
                                            <GitBranch size={14} className="text-muted-foreground" />
                                            Branch <span className="text-xs text-muted-foreground font-normal">(optional)</span>
                                        </Label>
                                        <Input
                                            id="branch"
                                            placeholder="Defaults to default branch"
                                            value={branch}
                                            onChange={(e) => setBranch(e.target.value)}
                                            disabled={isLoading}
                                        />
                                    </div>

                                    <div className="grid gap-2">
                                        <Label htmlFor="custom-title" className="text-sm font-medium">
                                            Project Title <span className="text-xs text-muted-foreground font-normal">(optional)</span>
                                        </Label>
                                        <Input
                                            id="custom-title"
                                            placeholder="Defaults to repo name"
                                            value={title}
                                            onChange={(e) => setTitle(e.target.value)}
                                            disabled={isLoading}
                                        />
                                    </div>
                                </div>
                            </div>

                            <div className="space-y-3 pt-2">
                                <div className="rounded-md bg-muted/40 p-2.5 text-[11px] text-muted-foreground border shrink-0">
                                    <span>WebContainer Notice: Repositories with a root <code className="text-foreground">package.json</code> boot automatically. Non-Node repositories run in Editor mode.</span>
                                </div>

                                <div className="flex justify-end gap-2 pt-1">
                                    <Button
                                        type="button"
                                        variant="outline"
                                        onClick={handleClose}
                                        disabled={isLoading}
                                        size="sm"
                                    >
                                        Cancel
                                    </Button>
                                    <Button
                                        type="submit"
                                        className="bg-[#e93f3f] hover:bg-[#d43535] text-white flex items-center gap-2"
                                        disabled={isLoading || !repoUrl.trim()}
                                        size="sm"
                                    >
                                        {isLoading ? (
                                            <>
                                                <Loader2 size={14} className="animate-spin" />
                                                <span>Importing...</span>
                                            </>
                                        ) : (
                                            <>
                                                <span>Import Repository</span>
                                                <ArrowRight size={14} />
                                            </>
                                        )}
                                    </Button>
                                </div>
                            </div>
                        </form>
                    </TabsContent>
                </Tabs>
            </DialogContent>
        </Dialog>
    );
}
