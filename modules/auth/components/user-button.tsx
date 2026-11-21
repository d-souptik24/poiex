"use client";
import React from "react";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { LogOut, User } from "lucide-react";
import LogoutButton from "./logout-button";
import { useCurrentUser } from "../hooks/use-current-user";

const UserButton = () => {
    const user = useCurrentUser();

    // Guard: Never render a phantom avatar or non-functional logout trigger without an active identity
    if (!user) return null;

    return (
        <DropdownMenu>
            <DropdownMenuTrigger
                render={
                    <button
                        type="button"
                        className="flex items-center justify-center rounded-full outline-none focus:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400 dark:focus-visible:ring-zinc-600 cursor-pointer"
                        aria-label="User profile menu"
                    />
                }
            >
                <Avatar className="size-8 transition-transform hover:scale-105">
                    <AvatarImage src={user?.image ?? undefined} alt={user?.name ?? undefined} />
                    <AvatarFallback className="bg-red-500">
                        <User className="size-4 text-white" />
                    </AvatarFallback>
                </Avatar>
            </DropdownMenuTrigger>

            <DropdownMenuContent
                align="end"
                side="bottom"
                sideOffset={16}
                className="w-60 p-1.5 shadow-xl border border-zinc-200 dark:border-zinc-800 bg-white/95 dark:bg-zinc-900/95 backdrop-blur-md rounded-xl"
            >
                <div className="flex flex-col space-y-1 px-2.5 py-2">
                    {user?.name && (
                        <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 truncate">
                            {user.name}
                        </p>
                    )}
                    <p className="text-xs text-zinc-500 dark:text-zinc-400 truncate select-all">
                        {user?.email}
                    </p>
                </div>
                <DropdownMenuSeparator className="my-1 bg-zinc-200 dark:bg-zinc-800" />
                <LogoutButton>
                    <DropdownMenuItem className="text-red-600 dark:text-red-400 focus:text-red-600 dark:focus:text-red-400 focus:bg-red-50 dark:focus:bg-red-950/40 cursor-pointer rounded-lg px-2.5 py-1.5 transition-colors">
                        <LogOut className="h-4 w-4 mr-2" />
                        Log out
                    </DropdownMenuItem>
                </LogoutButton>
            </DropdownMenuContent>
        </DropdownMenu>
    );
};

export default UserButton;
