import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";

export interface CurrentUser {
  id: string;
  email: string;
  name: string | null | undefined;
  avatar: string | null | undefined;
  plan: string;
  role: string;
  storageUsed: number;
}

export async function getSession(): Promise<CurrentUser | null> {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id || !session.user.email) return null;

  return {
    id: session.user.id,
    email: session.user.email,
    name: session.user.name,
    avatar: session.user.image,
    plan: session.user.plan || "free",
    role: session.user.role || "user",
    storageUsed: session.user.storageUsed || 0,
  };
}

