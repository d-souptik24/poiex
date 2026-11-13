import NextAuth from "next-auth";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { UserRole } from "@prisma/client";

import authConfig from "./auth.config";
import { db } from "./lib/db";
import { getUserById } from "./modules/auth/actions";

export const { auth, handlers, signIn, signOut } = NextAuth({
    callbacks: {
        /**
         * Handle user creation and account linking after a successful sign-in
         */
        async signIn({ user, account }) {
            if (!user || !account) return false;

            // Always persist latest OAuth tokens if the account already exists
            if (account.provider && account.providerAccountId && account.access_token) {
                try {
                    await db.account.updateMany({
                        where: {
                            provider: account.provider,
                            providerAccountId: account.providerAccountId,
                        },
                        data: {
                            access_token: account.access_token,
                            refresh_token: account.refresh_token,
                            expires_at: account.expires_at,
                            scope: account.scope,
                            token_type: account.token_type,
                        },
                    });
                } catch (error) {
                    console.error("Failed to refresh OAuth tokens on sign in:", error);
                }
            }

            const userEmail = user.email;
            if (!userEmail) return true;

            // Check if the user already exists
            const existingUser = await db.user.findUnique({
                where: { email: userEmail },
            });

            // If user does not exist, create a new one
            if (!existingUser) {
                const newUser = await db.user.create({
                    data: {
                        email: userEmail,
                        name: user.name,
                        image: user.image,

                        accounts: {
                            create: {
                                type: account.type,
                                provider: account.provider,
                                providerAccountId: account.providerAccountId,
                                refresh_token: account.refresh_token,
                                access_token: account.access_token,
                                expires_at: account.expires_at,
                                token_type: account.token_type,
                                scope: account.scope,
                                id_token: account.id_token,
                                session_state: account.session_state ? String(account.session_state) : null,
                            },
                        },
                    },
                });

                if (!newUser) return false; // Return false if user creation fails
            } else {
                // Link the account if user exists
                const existingAccount = await db.account.findUnique({
                    where: {
                        provider_providerAccountId: {
                            provider: account.provider,
                            providerAccountId: account.providerAccountId,
                        },
                    },
                });

                // If the account does not exist, create it
                if (!existingAccount) {
                    await db.account.create({
                        data: {
                            userId: existingUser.id,
                            type: account.type,
                            provider: account.provider,
                            providerAccountId: account.providerAccountId,
                            refresh_token: account.refresh_token,
                            access_token: account.access_token,
                            expires_at: account.expires_at,
                            token_type: account.token_type,
                            scope: account.scope,
                            id_token: account.id_token,
                            session_state: account.session_state ? String(account.session_state) : null,
                        },
                    });
                } else if (account.access_token) {
                    // Update tokens on subsequent logins
                    await db.account.update({
                        where: { id: existingAccount.id },
                        data: {
                            access_token: account.access_token,
                            refresh_token: account.refresh_token ?? existingAccount.refresh_token,
                            expires_at: account.expires_at ?? existingAccount.expires_at,
                            scope: account.scope ?? existingAccount.scope,
                            session_state: account.session_state ? String(account.session_state) : existingAccount.session_state,
                        },
                    });
                }
            }

            return true;
        },

        async jwt({ token }) {
            if (!token.sub) return token;
            const existingUser = await getUserById(token.sub);

            if (!existingUser) return token;
            // const exisitingAccount = await getAccountByUserId(existingUser.id);

            token.name = existingUser.name;
            token.email = existingUser.email;
            token.role = existingUser.role;

            return token;
        },

        async session({ session, token }) {
            // Attach the user ID from the token to the session
            if (token.sub && session.user) {
                session.user.id = token.sub;
            }

            if (token.role && session.user) {
                session.user.role = token.role as UserRole;
            }

            return session;
        },
    },

    secret: process.env.AUTH_SECRET,
    adapter: PrismaAdapter(db),
    session: { strategy: "jwt" },
    ...authConfig,
});
