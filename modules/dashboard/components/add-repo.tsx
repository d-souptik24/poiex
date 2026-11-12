"use client";

import { Button } from "@/components/ui/button";
import { ArrowDown } from "lucide-react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import ImportRepoModal from "./import-repo-modal";
import { importGithubRepo } from "../actions";

const AddRepo = () => {
    const [isModalOpen, setIsModalOpen] = useState(false);
    const router = useRouter();

    const handleImport = async (data: {
        repoUrl: string;
        branch?: string;
        title?: string;
    }) => {
        const res = await importGithubRepo(data);
        toast.success(`Repository '${res.title}' imported successfully!`);
        router.push(`/playground/${res.id}`);
    };

    return (
        <>
            <div
                onClick={() => setIsModalOpen(true)}
                className="group px-6 py-6 flex flex-row justify-between items-center border border-zinc-200/90 dark:border-zinc-800 rounded-xl bg-white dark:bg-card cursor-pointer 
          transition-all duration-300 ease-in-out
          hover:border-[#E93F3F] hover:scale-[1.01]
          shadow-[0_2px_12px_rgba(0,0,0,0.04)] dark:shadow-[0_2px_12px_rgba(0,0,0,0.3)]
          hover:shadow-[0_12px_30px_rgba(233,63,63,0.12)]"
            >
                <div className="flex flex-row justify-center items-start gap-4">
                    <Button
                        variant={"outline"}
                        className="flex justify-center items-center bg-zinc-50 dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700 group-hover:bg-[#fff8f8] dark:group-hover:bg-zinc-800 group-hover:border-[#E93F3F] group-hover:text-[#E93F3F] transition-colors duration-300 shadow-2xs"
                        size={"icon"}
                    >
                        <ArrowDown size={30} className="transition-transform duration-300 group-hover:translate-y-1" />
                    </Button>
                    <div className="flex flex-col">
                        <h1 className="text-xl font-bold text-[#e93f3f]">Open GitHub Repository</h1>
                        <p className="text-sm text-muted-foreground max-w-[220px]">Work with your repositories in our editor</p>
                    </div>
                </div>

                <div className="relative overflow-hidden">
                    <Image
                        src={"/github.svg"}
                        alt="Open GitHub repository"
                        width={150}
                        height={150}
                        className="transition-transform duration-300 group-hover:scale-110"
                    />
                </div>
            </div>

            <ImportRepoModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                onSubmit={handleImport}
            />
        </>
    );
};

export default AddRepo;
