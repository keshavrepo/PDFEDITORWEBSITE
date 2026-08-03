CREATE TABLE "analytics_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" varchar(64),
	"user_id" uuid,
	"category" varchar(30) NOT NULL,
	"action" varchar(60) NOT NULL,
	"product_id" varchar(50) DEFAULT 'launchstack' NOT NULL,
	"tool_name" varchar(100),
	"path" varchar(500),
	"from_path" varchar(500),
	"duration_ms" integer,
	"status" integer,
	"props" jsonb,
	"ip_address" varchar(45),
	"user_agent" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "analytics_search_queries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" varchar(64),
	"user_id" uuid,
	"query" varchar(200) NOT NULL,
	"results_count" integer DEFAULT 0 NOT NULL,
	"latency_ms" integer DEFAULT 0 NOT NULL,
	"source" varchar(30) DEFAULT 'global' NOT NULL,
	"first_click_href" text,
	"first_click_type" varchar(30),
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "analytics_sessions" (
	"session_id" varchar(64) PRIMARY KEY NOT NULL,
	"user_id" uuid,
	"ip_address" varchar(45),
	"user_agent" text,
	"referrer" text,
	"locale" varchar(20),
	"first_seen_at" timestamp DEFAULT now() NOT NULL,
	"last_seen_at" timestamp DEFAULT now() NOT NULL,
	"page_count" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
ALTER TABLE "analytics_events" ADD CONSTRAINT "analytics_events_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "analytics_search_queries" ADD CONSTRAINT "analytics_search_queries_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "analytics_sessions" ADD CONSTRAINT "analytics_sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "analytics_events_category_idx" ON "analytics_events" USING btree ("category","created_at");--> statement-breakpoint
CREATE INDEX "analytics_events_action_idx" ON "analytics_events" USING btree ("action","created_at");--> statement-breakpoint
CREATE INDEX "analytics_events_product_idx" ON "analytics_events" USING btree ("product_id","created_at");--> statement-breakpoint
CREATE INDEX "analytics_events_user_idx" ON "analytics_events" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "analytics_events_session_idx" ON "analytics_events" USING btree ("session_id","created_at");--> statement-breakpoint
CREATE INDEX "analytics_events_tool_idx" ON "analytics_events" USING btree ("tool_name","created_at");--> statement-breakpoint
CREATE INDEX "analytics_events_path_idx" ON "analytics_events" USING btree ("path","created_at");--> statement-breakpoint
CREATE INDEX "analytics_search_user_idx" ON "analytics_search_queries" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "analytics_search_query_idx" ON "analytics_search_queries" USING btree ("query");--> statement-breakpoint
CREATE INDEX "analytics_search_created_idx" ON "analytics_search_queries" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "analytics_sessions_user_idx" ON "analytics_sessions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "analytics_sessions_last_seen_idx" ON "analytics_sessions" USING btree ("last_seen_at");
