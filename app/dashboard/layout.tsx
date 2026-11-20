import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { getAllPlaygroundForUser } from "@/modules/dashboard/actions";
import { DashboardSidebar } from "@/modules/dashboard/components/dashboard-sidebar";
import { DeviceNotice } from "@/components/ui/device-notice";
import UserButton from "@/modules/auth/components/user-button";
import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";

export const metadata: Metadata = {
    title: "Dashboard",
};

export default async function DashboardLayout({
    children,
}: {
    children: React.ReactNode;
}) {

    const playgroundData = await getAllPlaygroundForUser();

    const technologyIconMap: Record<string, string> = {
        REACT: "Zap",
        NEXTJS: "Lightbulb",
        EXPRESS: "Database",
        VUE: "Compass",
        HONO: "FlameIcon",
        ANGULAR: "Terminal",
    }

    const formattedPlaygroundData = playgroundData?.map((item) => ({
        id: item.id,
        name: item.title,
        starred: item.Starmark?.[0]?.isMarked || false,
        icon: technologyIconMap[item.template] || "Code2"
    }))


    return (

        <SidebarProvider defaultOpen={true} cookieName="dashboard_sidebar_state">

            <div className="flex min-h-screen w-full overflow-x-hidden">
                {/* Dashboard Sidebar */}
                <DashboardSidebar initialPlaygroundData={formattedPlaygroundData} />
                <div className="flex-1 flex flex-col min-w-0 relative">
                    {/* Mobile Navigation Header */}
                    <header className="flex md:hidden h-14 shrink-0 items-center justify-between border-b border-zinc-200 dark:border-zinc-800 px-4 bg-white/95 dark:bg-zinc-950/95 backdrop-blur-md sticky top-0 z-20">
                        <div className="flex items-center gap-3">
                            <SidebarTrigger />
                            <Link href="/" className="flex items-center gap-2.5">
                                <Image
                                    src="/logo.svg"
                                    alt="PoiEx Logo"
                                    width={28}
                                    height={28}
                                    className="size-7 object-contain"
                                    priority
                                />
                                <span className="font-bold text-[17px] tracking-tight text-zinc-900 dark:text-zinc-100">
                                    PoiEx
                                </span>
                            </Link>
                        </div>
                        <div className="flex items-center gap-2">
                            <UserButton />
                        </div>
                    </header>
                    <DeviceNotice scope="dashboard" />
                    <main className="flex-1 bg-zinc-50/70 dark:bg-background transition-colors">{children}</main>
                </div>
            </div>
        </SidebarProvider>
    )

}
