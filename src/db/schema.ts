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
  primaryKey,
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
  role: varchar("role", { length: 50 }).default("user").notNull(),
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

// User files with ownership.
//
// Shared by every LaunchStack product: `productId` records which module wrote
// the entry, so the file manager stays a single implementation as products are
// added rather than each one keeping its own history.
export const files = pgTable(
  "files",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
    productId: varchar("product_id", { length: 50 }).default("pdfpilot").notNull(),
    filename: text("filename").notNull(),
    originalName: text("original_name").notNull(),
    size: integer("size").notNull(),
    mimeType: varchar("mime_type", { length: 100 }),
    status: varchar("status", { length: 50 }).default("pending").notNull(),
    storagePath: text("storage_path"),
    temporaryPath: text("temporary_path"),
    downloadCount: integer("download_count").default(0).notNull(),
    isFavorite: boolean("is_favorite").default(false).notNull(),
    // Soft delete keeps processing history intact when a file is removed.
    deletedAt: timestamp("deleted_at"),
    expiresAt: timestamp("expires_at"), // For free tier auto-delete
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    index("files_user_created_idx").on(table.userId, table.createdAt),
    index("files_user_product_idx").on(table.userId, table.productId),
  ]
);

// Processing history per user
export const processingHistory = pgTable("processing_history", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  productId: varchar("product_id", { length: 50 }).default("pdfpilot").notNull(),
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

// User favorites.
//
// `toolName` predates the platform and is kept as the identifier column;
// `kind` widens it so products can be favourited alongside tools without a
// second table or a breaking rename.
export const favorites = pgTable(
  "favorites",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
    toolName: varchar("tool_name", { length: 100 }).notNull(),
    kind: varchar("kind", { length: 20 }).default("tool").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("favorites_user_tool_unique").on(table.userId, table.toolName),
  ]
);

// Notification centre entries, written by any product on the platform.
export const notifications = pgTable(
  "notifications",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
    productId: varchar("product_id", { length: 50 }).default("launchstack").notNull(),
    // conversion, upload, subscription, account, system
    category: varchar("category", { length: 30 }).default("system").notNull(),
    // info, success, warning, error
    level: varchar("level", { length: 20 }).default("info").notNull(),
    title: varchar("title", { length: 200 }).notNull(),
    body: text("body"),
    href: text("href"),
    readAt: timestamp("read_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("notifications_user_created_idx").on(table.userId, table.createdAt),
    index("notifications_user_read_idx").on(table.userId, table.readAt),
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

export const blogCategories = pgTable("blog_categories", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: varchar("name", { length: 100 }).notNull(),
  slug: varchar("slug", { length: 120 }).notNull().unique(),
  description: text("description"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const blogPosts = pgTable(
  "blog_posts",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    authorId: uuid("author_id").references(() => users.id, { onDelete: "set null" }),
    categoryId: uuid("category_id").references(() => blogCategories.id, { onDelete: "set null" }),
    title: varchar("title", { length: 200 }).notNull(),
    slug: varchar("slug", { length: 220 }).notNull().unique(),
    excerpt: text("excerpt").notNull(),
    content: text("content").notNull(),
    featuredImage: text("featured_image"),
    status: varchar("status", { length: 20 }).default("draft").notNull(),
    seoTitle: varchar("seo_title", { length: 200 }),
    seoDescription: varchar("seo_description", { length: 320 }),
    seoKeywords: text("seo_keywords"),
    readingTime: integer("reading_time").default(1).notNull(),
    publishedAt: timestamp("published_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    index("blog_posts_status_published_idx").on(table.status, table.publishedAt),
    index("blog_posts_author_id_idx").on(table.authorId),
    index("blog_posts_category_id_idx").on(table.categoryId),
  ]
);

export const blogTags = pgTable("blog_tags", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: varchar("name", { length: 60 }).notNull(),
  slug: varchar("slug", { length: 80 }).notNull().unique(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const blogPostTags = pgTable(
  "blog_post_tags",
  {
    postId: uuid("post_id").references(() => blogPosts.id, { onDelete: "cascade" }).notNull(),
    tagId: uuid("tag_id").references(() => blogTags.id, { onDelete: "cascade" }).notNull(),
  },
  (table) => [primaryKey({ columns: [table.postId, table.tagId] })]
);

export const contactSubmissions = pgTable(
  "contact_submissions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    firstName: varchar("first_name", { length: 100 }).notNull(),
    lastName: varchar("last_name", { length: 100 }).notNull(),
    email: varchar("email", { length: 255 }).notNull(),
    subject: varchar("subject", { length: 200 }),
    message: text("message").notNull(),
    status: varchar("status", { length: 30 }).default("new").notNull(),
    ipAddress: varchar("ip_address", { length: 45 }),
    userAgent: text("user_agent"),
    notificationSentAt: timestamp("notification_sent_at"),
    respondedAt: timestamp("responded_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("contact_submissions_status_created_idx").on(table.status, table.createdAt),
    index("contact_submissions_email_idx").on(table.email),
  ]
);

/**
 * OfficePilot recent-documents mirror.
 *
 * The full document body lives in the browser (IndexedDB) so it is always
 * available offline. This row is a small index the server uses to list the
 * user's recent documents on the dashboard, the file manager and the
 * search results without round-tripping the local store.
 */
export const officeDocuments = pgTable(
  "office_documents",
  {
    id: varchar("id", { length: 80 }).primaryKey(),
    userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
    kind: varchar("kind", { length: 20 }).notNull(),
    title: varchar("title", { length: 200 }).notNull(),
    category: varchar("category", { length: 30 }).default("blank").notNull(),
    version: integer("version").default(1).notNull(),
    size: integer("size").default(0).notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("office_documents_user_updated_idx").on(table.userId, table.updatedAt),
    index("office_documents_user_kind_idx").on(table.userId, table.kind),
  ]
);
