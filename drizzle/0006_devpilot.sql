CREATE TABLE "dev_history" (
	"id" varchar(80) PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"tool_name" varchar(100) NOT NULL,
	"kind" varchar(20) DEFAULT 'tool' NOT NULL,
	"is_favorite" boolean DEFAULT false NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "dev_sessions" (
	"id" varchar(80) PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"kind" varchar(30) NOT NULL,
	"title" varchar(200) NOT NULL,
	"category" varchar(30) DEFAULT 'blank' NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"size" integer DEFAULT 0 NOT NULL,
	"is_favorite" boolean DEFAULT false NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "social_brand_kits" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"name" varchar(100) DEFAULT 'Default brand kit' NOT NULL,
	"logos" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"colors" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"fonts" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"profiles" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "social_brand_profiles" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"brands" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "social_media_assets" (
	"id" varchar(80) PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"project_id" varchar(80),
	"kind" varchar(20) NOT NULL,
	"title" varchar(200) NOT NULL,
	"filename" text NOT NULL,
	"mime_type" varchar(100),
	"size" integer DEFAULT 0 NOT NULL,
	"tags" jsonb,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "social_media_collections" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"collections" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "social_platform_profiles" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"profiles" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "social_projects" (
	"id" varchar(80) PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"kind" varchar(30) NOT NULL,
	"title" varchar(200) NOT NULL,
	"category" varchar(30) DEFAULT 'blank' NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"size" integer DEFAULT 0 NOT NULL,
	"is_favorite" boolean DEFAULT false NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "social_user_state" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"active_brand_id" text,
	"active_profile_id" text,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "dev_history" ADD CONSTRAINT "dev_history_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dev_sessions" ADD CONSTRAINT "dev_sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "social_brand_kits" ADD CONSTRAINT "social_brand_kits_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "social_brand_profiles" ADD CONSTRAINT "social_brand_profiles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "social_media_assets" ADD CONSTRAINT "social_media_assets_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "social_media_collections" ADD CONSTRAINT "social_media_collections_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "social_platform_profiles" ADD CONSTRAINT "social_platform_profiles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "social_projects" ADD CONSTRAINT "social_projects_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "social_user_state" ADD CONSTRAINT "social_user_state_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "dev_history_user_updated_idx" ON "dev_history" USING btree ("user_id","updated_at");--> statement-breakpoint
CREATE INDEX "dev_history_user_tool_idx" ON "dev_history" USING btree ("user_id","tool_name");--> statement-breakpoint
CREATE INDEX "dev_sessions_user_updated_idx" ON "dev_sessions" USING btree ("user_id","updated_at");--> statement-breakpoint
CREATE INDEX "dev_sessions_user_kind_idx" ON "dev_sessions" USING btree ("user_id","kind");--> statement-breakpoint
CREATE INDEX "social_media_assets_user_updated_idx" ON "social_media_assets" USING btree ("user_id","updated_at");--> statement-breakpoint
CREATE INDEX "social_media_assets_user_project_idx" ON "social_media_assets" USING btree ("user_id","project_id");--> statement-breakpoint
CREATE INDEX "social_projects_user_updated_idx" ON "social_projects" USING btree ("user_id","updated_at");--> statement-breakpoint
CREATE INDEX "social_projects_user_kind_idx" ON "social_projects" USING btree ("user_id","kind");