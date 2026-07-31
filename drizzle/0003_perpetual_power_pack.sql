CREATE TABLE "notifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"product_id" varchar(50) DEFAULT 'launchstack' NOT NULL,
	"category" varchar(30) DEFAULT 'system' NOT NULL,
	"level" varchar(20) DEFAULT 'info' NOT NULL,
	"title" varchar(200) NOT NULL,
	"body" text,
	"href" text,
	"read_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "favorites" ADD COLUMN "kind" varchar(20) DEFAULT 'tool' NOT NULL;--> statement-breakpoint
ALTER TABLE "files" ADD COLUMN "product_id" varchar(50) DEFAULT 'pdfpilot' NOT NULL;--> statement-breakpoint
ALTER TABLE "files" ADD COLUMN "is_favorite" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "files" ADD COLUMN "deleted_at" timestamp;--> statement-breakpoint
ALTER TABLE "files" ADD COLUMN "updated_at" timestamp DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "processing_history" ADD COLUMN "product_id" varchar(50) DEFAULT 'pdfpilot' NOT NULL;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "notifications_user_created_idx" ON "notifications" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "notifications_user_read_idx" ON "notifications" USING btree ("user_id","read_at");--> statement-breakpoint
CREATE INDEX "files_user_created_idx" ON "files" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "files_user_product_idx" ON "files" USING btree ("user_id","product_id");