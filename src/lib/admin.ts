import { redirect } from "next/navigation";
import { getSession, type CurrentUser } from "@/lib/auth";

export async function getAdmin(): Promise<CurrentUser | null> {
  const user = await getSession();
  return user?.role === "admin" ? user : null;
}

export async function requireAdmin(): Promise<CurrentUser> {
  const user = await getSession();
  if (!user) redirect("/login?callbackUrl=/admin/posts");
  if (user.role !== "admin") redirect("/dashboard");
  return user;
}
