"use client";

import React, { useState, useEffect, useCallback } from "react";
import { FaGithub, FaGoogle } from "react-icons/fa";
import { getUserConnectedAccounts } from "@/modules/dashboard/actions";
import { useCurrentUser } from "@/modules/auth/hooks/use-current-user";
import LogoutButton from "@/modules/auth/components/logout-button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { useEditorSettings } from "../hooks/use-editor-settings";
import { FONT_SIZE_OPTIONS, TAB_SIZE_OPTIONS } from "../types";
import { LogOut, RotateCcw } from "lucide-react";
import { toast } from "sonner";

export default function SettingsView() {
    const user = useCurrentUser();
    const { settings, updateSetting, resetDefaults } = useEditorSettings();
    const [connectedAccounts, setConnectedAccounts] = useState<{ hasGithub: boolean; hasGoogle: boolean }>({
        hasGithub: false,
        hasGoogle: false,
    });

    useEffect(() => {
        getUserConnectedAccounts().then(setConnectedAccounts).catch(() => {});
    }, []);

    const handleReset = useCallback(() => {
        resetDefaults();
        toast.success("Editor preferences reset to defaults");
    }, [resetDefaults]);

    return (
        <div className="max-w-3xl mx-auto py-6 sm:py-8 px-4 sm:px-6 space-y-6">
            <div className="space-y-1">
                <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">
                    Settings
                </h1>
                <p className="text-xs sm:text-sm text-muted-foreground">
                    Manage your account profile and in-browser editor preferences.
                </p>
            </div>

            {/* Account Card */}
            <div className="space-y-2">
                <h2 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">
                    Account
                </h2>
                <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/60 p-4 shadow-xs">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div className="flex items-start sm:items-center gap-3.5 min-w-0">
                            <Avatar className="size-11 border border-zinc-200 dark:border-zinc-800 shrink-0 mt-0.5 sm:mt-0">
                                <AvatarImage src={user?.image || ""} alt={user?.name || "User"} />
                                <AvatarFallback className="bg-zinc-100 dark:bg-zinc-800 text-xs font-semibold">
                                    {user?.name?.[0]?.toUpperCase() || user?.email?.[0]?.toUpperCase() || "U"}
                                </AvatarFallback>
                            </Avatar>
                            <div className="flex flex-col min-w-0 space-y-0.5">
                                <span className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 truncate">
                                    {user?.name || "Developer"}
                                </span>
                                <span className="text-xs text-muted-foreground truncate">
                                    {user?.email || "No email available"}
                                </span>
                                {(connectedAccounts.hasGithub || connectedAccounts.hasGoogle) && (
                                    <div className="flex items-center gap-1.5 flex-wrap pt-1">
                                        {connectedAccounts.hasGithub && (
                                            <span className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-medium bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-700">
                                                <FaGithub className="h-2.5 w-2.5" />
                                                GitHub Connected
                                            </span>
                                        )}
                                        {connectedAccounts.hasGoogle && (
                                            <span className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-medium bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-700">
                                                <FaGoogle className="h-2.5 w-2.5 text-red-500" />
                                                Google Connected
                                            </span>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>
                        <div className="pt-2 sm:pt-0 border-t sm:border-t-0 border-zinc-100 dark:border-zinc-800/80 flex sm:block justify-end">
                            <LogoutButton>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    className="w-full sm:w-auto h-8 text-xs text-red-600 dark:text-red-400 border-zinc-200 dark:border-zinc-800 hover:bg-red-50 dark:hover:bg-red-950/20 hover:text-red-700 dark:hover:text-red-300 shrink-0 transition-colors"
                                >
                                    <LogOut className="h-3.5 w-3.5 mr-1.5" />
                                    Sign out
                                </Button>
                            </LogoutButton>
                        </div>
                    </div>
                </div>
            </div>

            {/* Editor Defaults Card */}
            <div className="space-y-2">
                <div className="flex items-center justify-between">
                    <h2 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">
                        Editor
                    </h2>
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={handleReset}
                        className="h-8 px-2.5 text-xs text-muted-foreground hover:text-zinc-900 dark:hover:text-zinc-100"
                    >
                        <RotateCcw className="h-3 w-3 mr-1.5" />
                        Reset defaults
                    </Button>
                </div>

                <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/60 shadow-xs divide-y divide-zinc-200 dark:divide-zinc-800">
                    <div className="flex items-center justify-between px-4 py-3 gap-3">
                        <div className="flex flex-col">
                            <span className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                                Font size
                            </span>
                            <span className="text-[11px] text-muted-foreground hidden sm:inline">
                                Code editor text size in pixels
                            </span>
                        </div>
                        <NativeSelect
                            value={settings.fontSize}
                            onChange={(e) => updateSetting("fontSize", Number(e.target.value))}
                            size="sm"
                            className="w-44 sm:w-48 shrink-0"
                        >
                            {FONT_SIZE_OPTIONS.map((opt) => (
                                <NativeSelectOption key={opt.value} value={opt.value}>
                                    {opt.label}
                                </NativeSelectOption>
                            ))}
                        </NativeSelect>
                    </div>

                    <div className="flex items-center justify-between px-4 py-3 gap-3">
                        <div className="flex flex-col">
                            <span className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                                Tab size
                            </span>
                            <span className="text-[11px] text-muted-foreground hidden sm:inline">
                                Indentation width per tab stop
                            </span>
                        </div>
                        <NativeSelect
                            value={settings.tabSize}
                            onChange={(e) => updateSetting("tabSize", Number(e.target.value))}
                            size="sm"
                            className="w-44 sm:w-48 shrink-0"
                        >
                            {TAB_SIZE_OPTIONS.map((opt) => (
                                <NativeSelectOption key={opt.value} value={opt.value}>
                                    {opt.label}
                                </NativeSelectOption>
                            ))}
                        </NativeSelect>
                    </div>

                    <div className="flex items-center justify-between px-4 py-3 gap-3">
                        <div className="flex flex-col">
                            <span className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                                Word wrap
                            </span>
                            <span className="text-[11px] text-muted-foreground hidden sm:inline">
                                Wrap code lines exceeding editor width
                            </span>
                        </div>
                        <Switch
                            checked={settings.wordWrap}
                            onCheckedChange={(checked) => updateSetting("wordWrap", checked)}
                        />
                    </div>

                    <div className="flex items-center justify-between px-4 py-3 gap-3">
                        <div className="flex flex-col">
                            <span className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                                Minimap
                            </span>
                            <span className="text-[11px] text-muted-foreground hidden sm:inline">
                                Display miniature code outline on the right
                            </span>
                        </div>
                        <Switch
                            checked={settings.minimap}
                            onCheckedChange={(checked) => updateSetting("minimap", checked)}
                        />
                    </div>
                </div>
            </div>
        </div>
    );
}
