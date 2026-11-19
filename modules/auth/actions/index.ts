import { auth } from "@/auth";
import { db } from "@/lib/db";

export const getUserById = async (id: string) => {
    try {
        const user = await db.user.findUnique({
            where: { id },
        });
        return user;
    } catch (error) {
        console.error("Error fetching user by id:", error);
        return null;
    }
};

export const currentUser = async () => {
    const session = await auth();
    return session?.user;
};
