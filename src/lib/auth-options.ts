import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import GoogleProvider from "next-auth/providers/google";
import { compare } from "bcryptjs";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { auditLogs, users } from "@/db/schema";
import { authAdapter } from "@/lib/auth-adapter";
import { isGoogleAuthConfigured } from "@/lib/env";

const credentialsSchema = z.object({
  email: z.string().trim().email().max(255).transform((value) => value.toLowerCase()),
  password: z.string().min(1).max(128),
});

// Comparing against a fixed hash keeps unknown-email requests close to the
// timing profile of valid-email requests.
const DUMMY_PASSWORD_HASH =
  "$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxxYvFq5sAiXN3V7ZbqO3v.N9mK";

const providers: NextAuthOptions["providers"] = [
  CredentialsProvider({
    name: "Email and password",
    credentials: {
      email: { label: "Email", type: "email" },
      password: { label: "Password", type: "password" },
    },
    async authorize(rawCredentials) {
      const parsed = credentialsSchema.safeParse(rawCredentials);
      if (!parsed.success) return null;

      const [user] = await db
        .select()
        .from(users)
        .where(eq(users.email, parsed.data.email))
        .limit(1);

      const passwordMatches = await compare(
        parsed.data.password,
        user?.passwordHash || DUMMY_PASSWORD_HASH
      );

      if (!user?.passwordHash || !passwordMatches) return null;

      return {
        id: user.id,
        email: user.email,
        name: user.name,
        image: user.avatar,
        plan: user.plan,
        role: user.role,
        storageUsed: user.storageUsed,
      };
    },
  }),
];

if (isGoogleAuthConfigured()) {
  providers.push(
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      allowDangerousEmailAccountLinking: false,
    })
  );
}

export const authOptions: NextAuthOptions = {
  adapter: authAdapter,
  providers,
  secret: process.env.NEXTAUTH_SECRET,
  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60,
  },
  pages: {
    signIn: "/login",
    error: "/login",
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) token.sub = user.id;
      if (!token.sub) return token;

      const [currentUser] = await db
        .select({
          id: users.id,
          email: users.email,
          name: users.name,
          avatar: users.avatar,
          plan: users.plan,
          role: users.role,
          storageUsed: users.storageUsed,
        })
        .from(users)
        .where(eq(users.id, token.sub))
        .limit(1);

      if (!currentUser) return {};

      token.sub = currentUser.id;
      token.email = currentUser.email;
      token.name = currentUser.name;
      token.picture = currentUser.avatar;
      token.plan = currentUser.plan;
      token.role = currentUser.role;
      token.storageUsed = currentUser.storageUsed;
      return token;
    },
    async session({ session, token }) {
      if (session.user && token.sub) {
        session.user.id = token.sub;
        session.user.plan = token.plan || "free";
        session.user.role = token.role || "user";
        session.user.storageUsed = token.storageUsed || 0;
      }
      return session;
    },
  },
  events: {
    async signIn({ user }) {
      if (!user.id) return;
      await Promise.all([
        db.update(users).set({ lastLogin: new Date() }).where(eq(users.id, user.id)),
        db.insert(auditLogs).values({
          userId: user.id,
          action: "user.signed_in",
          resourceType: "user",
          resourceId: user.id,
        }),
      ]);
    },
  },
};
