import type {
  Adapter,
  AdapterAccount,
  AdapterUser,
} from "next-auth/adapters";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { accounts, users } from "@/db/schema";

type UserRow = typeof users.$inferSelect;

function toAdapterUser(user: UserRow): AdapterUser {
  return {
    id: user.id,
    email: user.email,
    emailVerified: user.emailVerified ? user.updatedAt : null,
    name: user.name,
    image: user.avatar,
  };
}

/**
 * The stock Drizzle adapter expects Auth.js' default schema. PDFPilot has a
 * richer existing user model, so this small adapter maps that model explicitly
 * instead of maintaining a second users table.
 */
export const authAdapter: Adapter = {
  async createUser(user: Omit<AdapterUser, "id">) {
    const [created] = await db
      .insert(users)
      .values({
        email: user.email.toLowerCase(),
        name: user.name,
        avatar: user.image,
        emailVerified: Boolean(user.emailVerified),
      })
      .returning();

    return toAdapterUser(created);
  },

  async getUser(id) {
    const [user] = await db.select().from(users).where(eq(users.id, id)).limit(1);
    return user ? toAdapterUser(user) : null;
  },

  async getUserByEmail(email) {
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.email, email.toLowerCase()))
      .limit(1);
    return user ? toAdapterUser(user) : null;
  },

  async getUserByAccount({ provider, providerAccountId }) {
    const [result] = await db
      .select({ user: users })
      .from(accounts)
      .innerJoin(users, eq(accounts.userId, users.id))
      .where(
        and(
          eq(accounts.provider, provider),
          eq(accounts.providerAccountId, providerAccountId)
        )
      )
      .limit(1);

    return result ? toAdapterUser(result.user) : null;
  },

  async updateUser(user) {
    const values: Partial<typeof users.$inferInsert> = { updatedAt: new Date() };
    if (user.email !== undefined) values.email = user.email.toLowerCase();
    if (user.name !== undefined) values.name = user.name;
    if (user.image !== undefined) values.avatar = user.image;
    if (user.emailVerified !== undefined) {
      values.emailVerified = Boolean(user.emailVerified);
    }

    const [updated] = await db
      .update(users)
      .set(values)
      .where(eq(users.id, user.id))
      .returning();

    if (!updated) throw new Error("User not found");
    return toAdapterUser(updated);
  },

  async deleteUser(id) {
    await db.delete(users).where(eq(users.id, id));
  },

  async linkAccount(account: AdapterAccount) {
    await db.insert(accounts).values({
      userId: account.userId,
      type: account.type,
      provider: account.provider,
      providerAccountId: account.providerAccountId,
      refreshToken: account.refresh_token,
      accessToken: account.access_token,
      expiresAt: account.expires_at,
      tokenType: account.token_type,
      scope: account.scope,
      idToken: account.id_token,
      sessionState:
        typeof account.session_state === "string" ? account.session_state : null,
    });
  },

  async unlinkAccount({
    provider,
    providerAccountId,
  }: Pick<AdapterAccount, "provider" | "providerAccountId">) {
    await db
      .delete(accounts)
      .where(
        and(
          eq(accounts.provider, provider),
          eq(accounts.providerAccountId, providerAccountId)
        )
      );
  },
};
