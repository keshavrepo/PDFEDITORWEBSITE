import type { DefaultSession } from "next-auth";

export {};

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      plan: string;
      role: string;
      storageUsed: number;
    } & DefaultSession["user"];
  }

  interface User {
    plan?: string;
    role?: string;
    storageUsed?: number;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    plan?: string;
    role?: string;
    storageUsed?: number;
  }
}
