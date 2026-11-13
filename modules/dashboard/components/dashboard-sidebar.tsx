"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import {
    Code2,
    Compass,
    FolderPlus,
    History,
    Home,
    LayoutDashboard,
    Lightbulb,
    type LucideIcon,
    Plus,
    Settings,
    Star,
    Terminal,
    Zap,
    Database,
    FlameIcon,
} from "lucide-react"
import {
    Sidebar,
    SidebarContent,
    SidebarFooter,
    SidebarGroup,
    SidebarGroupContent,
    SidebarGroupLabel,
    SidebarGroupAction,
    SidebarHeader,
    SidebarMenu,
    SidebarMenuButton,
    SidebarMenuItem,
    SidebarRail,
} from "@/components/ui/sidebar"
import Image from "next/image"

// Define the interface for a single playground item, icon is now a string
interface PlaygroundData {
    id: string
    name: string
    icon: string // Changed to string
    starred: boolean
}

// Map icon names (strings) to their corresponding LucideIcon components
const lucideIconMap: Record<string, LucideIcon> = {
    Zap: Zap,
    Lightbulb: Lightbulb,
    Database: Database,
    Compass: Compass,
    FlameIcon: FlameIcon,
    Terminal: Terminal,
    Code2: Code2, // Include the default icon
    // Add any other icons you might use dynamically
}

export function DashboardSidebar({ initialPlaygroundData }: { initialPlaygroundData: PlaygroundData[] }) {
    const pathname = usePathname()
    const [starredPlaygrounds, setStarredPlaygrounds] = useState(initialPlaygroundData.filter((p) => p.starred))
    const [recentPlaygrounds, setRecentPlaygrounds] = useState(initialPlaygroundData)
    const [prevData, setPrevData] = useState(initialPlaygroundData)

    // Adjust state during render when server props change (React 19 pattern avoiding cascading renders)
    if (prevData !== initialPlaygroundData) {
        setPrevData(initialPlaygroundData)
        setStarredPlaygrounds(initialPlaygroundData.filter((p) => p.starred))
        setRecentPlaygrounds(initialPlaygroundData)
    }

    // Optimistic realtime updates (0ms latency without waiting for server response)
    useEffect(() => {
        const handleStarToggle = (event: Event) => {
            const customEvent = event as CustomEvent<{ id: string; isMarked: boolean }>
            if (!customEvent.detail) return
            const { id, isMarked } = customEvent.detail

            setStarredPlaygrounds((prev) => {
                if (isMarked) {
                    if (prev.some((p) => p.id === id)) return prev
                    const item = recentPlaygrounds.find((p) => p.id === id)
                    if (item) {
                        return [...prev, { ...item, starred: true }]
                    }
                    return prev
                } else {
                    return prev.filter((p) => p.id !== id)
                }
            })

            setRecentPlaygrounds((prev) =>
                prev.map((p) => (p.id === id ? { ...p, starred: isMarked } : p))
            )
        }

        const handleProjectDelete = (event: Event) => {
            const customEvent = event as CustomEvent<{ id: string }>
            if (!customEvent.detail) return
            const { id } = customEvent.detail
            setStarredPlaygrounds((prev) => prev.filter((p) => p.id !== id))
            setRecentPlaygrounds((prev) => prev.filter((p) => p.id !== id))
        }

        window.addEventListener("poiex:star-toggle", handleStarToggle)
        window.addEventListener("poiex:project-delete", handleProjectDelete)

        return () => {
            window.removeEventListener("poiex:star-toggle", handleStarToggle)
            window.removeEventListener("poiex:project-delete", handleProjectDelete)
        }
    }, [recentPlaygrounds])

    return (
        <Sidebar variant="inset" collapsible="icon" className="border-r border-zinc-200 dark:border-sidebar-border bg-white dark:bg-sidebar transition-colors">
            <SidebarHeader className="pt-3 pb-1">
                <SidebarMenu>
                    <SidebarMenuItem>
                        <SidebarMenuButton
                            size="lg"
                            render={<Link href="/" />}
                            tooltip="PoiEx Home"
                            className="h-10 px-2 gap-2.5 hover:bg-zinc-100 dark:hover:bg-zinc-800/60 transition-colors"
                        >
                            <div className="flex size-7 items-center justify-center shrink-0">
                                <Image
                                    src="/logo.svg"
                                    alt="PoiEx Logo"
                                    width={28}
                                    height={28}
                                    className="size-7 object-contain"
                                    priority
                                />
                            </div>
                            <div className="flex items-center min-w-0 group-data-[collapsible=icon]:hidden">
                                <span className="font-bold text-[17px] tracking-tight text-zinc-900 dark:text-white">
                                    PoiEx
                                </span>
                            </div>
                        </SidebarMenuButton>
                    </SidebarMenuItem>
                </SidebarMenu>
            </SidebarHeader>
            <SidebarContent>
                <SidebarGroup>
                    <SidebarMenu>
                        <SidebarMenuItem>
                            <SidebarMenuButton
                                render={<Link href="/" />}
                                isActive={pathname === "/"}
                                tooltip="Home"
                            >
                                <Home className="h-4 w-4" />
                                <span>Home</span>
                            </SidebarMenuButton>
                        </SidebarMenuItem>
                        <SidebarMenuItem>
                            <SidebarMenuButton
                                render={<Link href="/dashboard" />}
                                isActive={pathname === "/dashboard"}
                                tooltip="Dashboard"
                            >
                                <LayoutDashboard className="h-4 w-4" />
                                <span>Dashboard</span>
                            </SidebarMenuButton>
                        </SidebarMenuItem>

                    </SidebarMenu>
                </SidebarGroup>

                <SidebarGroup>
                    <SidebarGroupLabel>
                        <Star className="h-4 w-4 mr-2" />
                        Starred
                    </SidebarGroupLabel>
                    <SidebarGroupAction title="Add starred playground">
                        <Plus className="h-4 w-4" />
                    </SidebarGroupAction>
                    <SidebarGroupContent>
                        <SidebarMenu>

                            {starredPlaygrounds.length === 0 && recentPlaygrounds.length === 0 ? (
                                <div className="text-center text-muted-foreground py-4 w-full">Create your playground</div>
                            ) : (
                                starredPlaygrounds.map((playground) => {
                                    const IconComponent = lucideIconMap[playground.icon] || Code2;
                                    return (
                                        <SidebarMenuItem key={playground.id}>
                                            <SidebarMenuButton
                                                render={<Link href={`/playground/${playground.id}`} />}
                                                isActive={pathname === `/playground/${playground.id}`}
                                                tooltip={playground.name}
                                            >
                                                {IconComponent && <IconComponent className="h-4 w-4" />}
                                                <span>{playground.name}</span>
                                            </SidebarMenuButton>
                                        </SidebarMenuItem>
                                    );
                                })
                            )}
                        </SidebarMenu>
                    </SidebarGroupContent>
                </SidebarGroup>

                <SidebarGroup>
                    <SidebarGroupLabel>
                        <History className="h-4 w-4 mr-2" />
                        Recent
                    </SidebarGroupLabel>
                    <SidebarGroupAction title="Create new playground">
                        <FolderPlus className="h-4 w-4" />
                    </SidebarGroupAction>
                    <SidebarGroupContent>
                        <SidebarMenu>
                            {starredPlaygrounds.length === 0 && recentPlaygrounds.length === 0 ? null : (
                                recentPlaygrounds.map((playground) => {
                                    const IconComponent = lucideIconMap[playground.icon] || Code2;
                                    return (
                                        <SidebarMenuItem key={playground.id}>
                                            <SidebarMenuButton
                                                render={<Link href={`/playground/${playground.id}`} />}
                                                isActive={pathname === `/playground/${playground.id}`}
                                                tooltip={playground.name}
                                            >
                                                {IconComponent && <IconComponent className="h-4 w-4" />}
                                                <span>{playground.name}</span>
                                            </SidebarMenuButton>
                                        </SidebarMenuItem>
                                    );
                                })
                            )}
                            <SidebarMenuItem>
                                <SidebarMenuButton
                                    render={<Link href="/dashboard" />}
                                    tooltip="View all"
                                >
                                    <span className="text-sm text-muted-foreground">View all playgrounds</span>
                                </SidebarMenuButton>
                            </SidebarMenuItem>
                        </SidebarMenu>
                    </SidebarGroupContent>
                </SidebarGroup>
            </SidebarContent>
            <SidebarFooter>
                <SidebarMenu>
                    <SidebarMenuItem>
                        <SidebarMenuButton
                            render={<Link href="/settings" />}
                            isActive={pathname === "/settings"}
                            tooltip="Settings"
                        >
                            <Settings className="h-4 w-4" />
                            <span>Settings</span>
                        </SidebarMenuButton>
                    </SidebarMenuItem>
                </SidebarMenu>
            </SidebarFooter>
            <SidebarRail />
        </Sidebar>
    )
}
