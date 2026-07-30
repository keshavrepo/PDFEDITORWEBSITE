import { getServerSession } from "next-auth";

export async function getSession() {
  const session = await getServerSession();
  if (!session?.user) return null;
  
  return {
    id: (session.user as any).id || '',
    email: session.user.email || '',
    name: session.user.name,
    avatar: session.user.image,
    plan: (session.user as any).plan || 'free',
    storageUsed: (session.user as any).storageUsed || 0,
  };
}

export async function getCurrentUser() {
  return await getSession();
}
