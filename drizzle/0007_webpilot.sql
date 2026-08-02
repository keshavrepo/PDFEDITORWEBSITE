CREATE TABLE "web_history" (
	"id" varchar(80) PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"tool_name" varchar(100) NOT NULL,
	"kind" varchar(20) DEFAULT 'tool' NOT NULL,
	"is_favorite" boolean DEFAULT false NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "web_sessions" (
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
ALTER TABLE "web_sessions" ADD CONSTRAINT "web_sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "web_history" ADD CONSTRAINT "web_history_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "web_sessions_user_updated_idx" ON "web_sessions" USING btree ("user_id","updated_at");
--> statement-breakpoint
CREATE INDEX "web_sessions_user_kind_idx" ON "web_sessions" USING btree ("user_id","kind");
--> statement-breakpoint
CREATE INDEX "web_history_user_updated_idx" ON "web_history" USING btree ("user_id","updated_at");
--> statement-breakpoint
CREATE INDEX "web_history_user_tool_idx" ON "web_history" USING btree ("user_id","tool_name");
