import { cn } from "@/lib/utils";
import { Footer } from "@/modules/home/footer";
import { Header } from "@/modules/home/header";
import { Metadata } from "next";

export const metadata: Metadata = {
    title: {
        template: "PoiEX - AI Code Editor ",
        default: "Code Editor For enthusiast - PoiEx",
    },
};
export default function HomeLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <div className="relative min-h-screen flex flex-col overflow-x-hidden">
            <div
                className={cn(
                    "pointer-events-none absolute inset-0 z-0",
                    "bg-size-[40px_40px]",
                    "bg-[linear-gradient(to_right,#e4e4e7_1px,transparent_1px),linear-gradient(to_bottom,#e4e4e7_1px,transparent_1px)]",
                    "dark:bg-[linear-gradient(to_right,#262626_1px,transparent_1px),linear-gradient(to_bottom,#262626_1px,transparent_1px)]",
                )}
            />
            <div className="pointer-events-none absolute inset-0 z-0 flex items-center justify-center bg-white mask-[radial-gradient(ellipse_at_center,transparent_20%,black)] dark:bg-black" />
            <Header />
            <main className="relative z-10 flex-1 flex flex-col w-full">{children}</main>
            <Footer />
        </div>
    );
}
