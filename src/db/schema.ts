import {
  pgTable,
  text,
  timestamp,
  uuid,
  integer,
  boolean,
  jsonb,
  varchar,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";

// Users table with OAuth support
export const users = pgTable("users", {
  id: uuid("id").defaultRandom().primaryKey(),
  email: varchar("email", { length: 255 }).notNull().unique(),
  passwordHash: text("password_hash"), // Nullable for OAuth users
  name: varchar("name", { length: 255 }),
  emailVerified: boolean("email_verified").default(false),
  avatar: text("avatar"),
  googleId: varchar("google_id", { length: 255 }).unique(),
  plan: varchar("plan", { length: 50 }).default("free").notNull(),
  storageUsed: integer("storage_used").default(0).notNull(),
  dailyProcessingCount: integer("daily_processing_count").default(0).notNull(),
  lastProcessingReset: timestamp("last_processing_reset").defaultNow(),
  lastLogin: timestamp("last_login"),
  preferences: jsonb("preferences"), // Theme, language, notifications
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// NextAuth sessions
export const sessions = pgTable("sessions", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  sessionToken: text("session_token").notNull().unique(),
  expires: timestamp("expires").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const passwordResetTokens = pgTable(
  "password_reset_tokens",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    tokenHash: varchar("token_hash", { length: 64 }).notNull().unique(),
    expiresAt: timestamp("expires_at").notNull(),
    usedAt: timestamp("used_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("password_reset_tokens_user_id_idx").on(table.userId),
    index("password_reset_tokens_expires_at_idx").on(table.expiresAt),
  ]
);

// OAuth accounts (Google, etc.)
export const accounts = pgTable(
  "accounts",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
    type: varchar("type", { length: 50 }).notNull(),
    provider: varchar("provider", { length: 50 }).notNull(),
    providerAccountId: varchar("provider_account_id", { length: 255 }).notNull(),
    refreshToken: text("refresh_token"),
    accessToken: text("access_token"),
    expiresAt: integer("expires_at"),
    tokenType: varchar("token_type", { length: 50 }),
    scope: text("scope"),
    idToken: text("id_token"),
    sessionState: text("session_state"),
  },
  (table) => [
    uniqueIndex("accounts_provider_account_unique").on(
      table.provider,
      table.providerAccountId
    ),
    index("accounts_user_id_idx").on(table.userId),
  ]
);

// User files with ownership
export const files = pgTable("files", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  filename: text("filename").notNull(),
  originalName: text("original_name").notNull(),
  size: integer("size").notNull(),
  mimeType: varchar("mime_type", { length: 100 }),
  status: varchar("status", { length: 50 }).default("pending").notNull(),
  storagePath: text("storage_path"),
  temporaryPath: text("temporary_path"),
  downloadCount: integer("download_count").default(0).notNull(),
  expiresAt: timestamp("expires_at"), // For free tier auto-delete
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Processing history per user
export const processingHistory = pgTable("processing_history", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  toolName: varchar("tool_name", { length: 100 }).notNull(),
  fileId: uuid("file_id").references(() => files.id, { onDelete: "set null" }),
  inputFileSize: integer("input_file_size"),
  outputFileSize: integer("output_file_size"),
  processingTime: integer("processing_time"), // milliseconds
  status: varchar("status", { length: 50 }).default("completed").notNull(),
  errorMessage: text("error_message"),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// User favorites
export const favorites = pgTable(
  "favorites",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
    toolName: varchar("tool_name", { length: 100 }).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("favorites_user_tool_unique").on(table.userId, table.toolName),
  ]
);

// Subscriptions
export const subscriptions = pgTable("subscriptions", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }).notNull().unique(),
  stripeCustomerId: varchar("stripe_customer_id", { length: 255 }).unique(),
  stripeSubscriptionId: varchar("stripe_subscription_id", { length: 255 }).unique(),
  stripePriceId: varchar("stripe_price_id", { length: 255 }),
  status: varchar("status", { length: 50 }).notNull(), // active, canceled, past_due
  currentPeriodStart: timestamp("current_period_start"),
  currentPeriodEnd: timestamp("current_period_end"),
  cancelAtPeriodEnd: boolean("cancel_at_period_end").default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Usage tracking for rate limiting
export const usageTracking = pgTable("usage_tracking", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  date: timestamp("date").defaultNow().notNull(),
  processingCount: integer("processing_count").default(0).notNull(),
  storageUsed: integer("storage_used").default(0).notNull(),
  apiCalls: integer("api_calls").default(0).notNull(),
});

// Audit logs for security
export const auditLogs = pgTable("audit_logs", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }),
  action: varchar("action", { length: 100 }).notNull(),
  resourceType: varchar("resource_type", { length: 50 }),
  resourceId: varchar("resource_id", { length: 255 }),
  ipAddress: varchar("ip_address", { length: 45 }),
  userAgent: text("user_agent"),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
