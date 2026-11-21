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
        async signIn({ user, account, profile }) {
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

                if (existingAccount) {
                    // User is already linked. Update tokens if refreshed and allow sign-in without external network call
                    if (account.access_token) {
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
                    return true;
                }

                // If linking a new external OAuth provider to an existing account,
                // verify that the incoming email is officially verified by the provider to prevent account takeover (ATO)
                if (account.provider === "github") {
                    if (account.access_token) {
                        try {
                            const res = await fetch("https://api.github.com/user/emails", {
                                headers: {
                                    Authorization: `Bearer ${account.access_token}`,
                                    "User-Agent": "PoiEx-IDE",
                                },
                                signal: AbortSignal.timeout(4000),
                            });
                            if (res.ok) {
                                const emails: Array<{ email: string; verified: boolean }> = await res.json();
                                const matched = emails.find((e) => e.email.toLowerCase() === userEmail.toLowerCase());
                                if (!matched?.verified) {
                                    console.warn(`[Auth] Rejected linking unverified GitHub email (${userEmail}) to existing account (${existingUser.id})`);
                                    return false;
                                }
                            } else {
                                console.warn(`[Auth] GitHub emails endpoint returned status ${res.status}`);
                                return false;
                            }
                        } catch (err) {
                            console.error("[Auth] Failed to verify GitHub email:", err);
                            return false;
                        }
                    } else {
                        return false;
                    }
                }

                // If the account does not exist, create it
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
