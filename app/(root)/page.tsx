import { Button } from "@/components/ui/button";
import { ArrowUpRight } from "lucide-react";
import Image from "next/image";
import Link from "next/link";

export default function Home() {
  return (
    <div className="flex-1 flex flex-col items-center justify-center max-w-4xl mx-auto px-4 py-8 text-center">
      <div className="flex flex-col justify-center items-center">
        <Image
          src="/hero.svg"
          alt="PoiEx Code Editor Hero"
          height={320}
          width={320}
          priority
          className="w-auto max-h-[260px] sm:max-h-[300px] object-contain drop-shadow-sm"
        />

        <h1 className="mt-6 text-4xl sm:text-5xl md:text-6xl font-extrabold text-center bg-clip-text text-transparent bg-gradient-to-r from-rose-500 via-red-500 to-pink-500 dark:from-rose-400 dark:via-red-400 dark:to-pink-400 tracking-tight leading-tight">
          Write Code with Intelligence
        </h1>
      </div>

      <p className="mt-4 text-base sm:text-lg text-center text-muted-foreground px-4 max-w-2xl leading-relaxed">
        PoiEx is a powerful and intelligent code editor that enhances your
        coding experience with advanced features and seamless integration.
        Designed to help you write, debug, and optimize your code efficiently.
      </p>

      <div className="mt-8 mb-4">
        <Link href="/dashboard">
          <Button variant="brand" size="lg" className="group shadow-md">
            Get Started
            <ArrowUpRight className="size-4 ms-1 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
          </Button>
        </Link>
      </div>
    </div>
  );
}
