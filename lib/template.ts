import { Templates } from "@prisma/client";

export const templatePaths: Record<Templates, string> = {
    REACT: "poiex-starters/vite-shadcn",
    NEXTJS: "poiex-starters/nextjs-shadcn",
    EXPRESS: "poiex-starters/express-simple",
    VUE: "poiex-starters/vue",
    HONO: "poiex-starters/hono-nodejs-starter",
    ANGULAR: "poiex-starters/angular",
} as const;
