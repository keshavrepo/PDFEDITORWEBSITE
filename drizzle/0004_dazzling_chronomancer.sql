CREATE TABLE "office_documents" (
	"id" varchar(80) PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"kind" varchar(20) NOT NULL,
	"title" varchar(200) NOT NULL,
	"category" varchar(30) DEFAULT 'blank' NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"size" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "office_documents" ADD CONSTRAINT "office_documents_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "office_documents_user_updated_idx" ON "office_documents" USING btree ("user_id","updated_at");--> statement-breakpoint
CREATE INDEX "office_documents_user_kind_idx" ON "office_documents" USING btree ("user_id","kind");