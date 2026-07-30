import type { DefaultSession } from "next-auth";

export {};

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      plan: string;
      storageUsed: number;
    } & DefaultSession["user"];
  }

  interface User {
    plan?: string;
    storageUsed?: number;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    plan?: string;
    storageUsed?: number;
  }
}
