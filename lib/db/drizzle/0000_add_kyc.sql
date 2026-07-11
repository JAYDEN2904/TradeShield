CREATE TYPE "public"."kyc_status" AS ENUM('none', 'pending', 'approved', 'rejected');--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('buyer', 'supplier', 'both');--> statement-breakpoint
CREATE TYPE "public"."order_status" AS ENUM('pending_supplier_confirmation', 'awaiting_payment', 'payment_processing', 'in_escrow', 'shipped', 'payout_processing', 'completed', 'disputed', 'post_release_disputed', 'expired', 'rejected', 'payout_failed');--> statement-breakpoint
CREATE TYPE "public"."transaction_type" AS ENUM('collection', 'disbursement', 'refund');--> statement-breakpoint
CREATE TYPE "public"."dispute_category" AS ENUM('quality', 'non_delivery', 'quantity', 'other');--> statement-breakpoint
CREATE TYPE "public"."dispute_status" AS ENUM('open', 'resolved');--> statement-breakpoint
CREATE TYPE "public"."admin_action_type" AS ENUM('release_funds', 'refund', 'retry_payout', 'expire_order', 'resolve_dispute');--> statement-breakpoint
CREATE TYPE "public"."kyc_doc_status" AS ENUM('pending', 'accepted', 'rejected');--> statement-breakpoint
CREATE TYPE "public"."kyc_doc_type" AS ENUM('ghana_card_front', 'ghana_card_back');--> statement-breakpoint
CREATE TABLE "users" (
	"id" serial PRIMARY KEY NOT NULL,
	"phone" text NOT NULL,
	"role" "user_role" DEFAULT 'buyer' NOT NULL,
	"business_name" text NOT NULL,
	"location" text NOT NULL,
	"category" text,
	"payout_momo_number" text,
	"password_hash" text,
	"is_admin" boolean DEFAULT false NOT NULL,
	"kyc_status" "kyc_status" DEFAULT 'none' NOT NULL,
	"kyc_submitted_at" timestamp with time zone,
	"kyc_reviewed_at" timestamp with time zone,
	"kyc_rejection_reason" text,
	"ghana_card_number" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_phone_unique" UNIQUE("phone")
);
--> statement-breakpoint
CREATE TABLE "otp_codes" (
	"id" serial PRIMARY KEY NOT NULL,
	"phone" text NOT NULL,
	"code" text NOT NULL,
	"used" boolean DEFAULT false NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"purpose" text DEFAULT 'registration' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "products" (
	"id" serial PRIMARY KEY NOT NULL,
	"supplier_id" integer NOT NULL,
	"name" text NOT NULL,
	"category" text NOT NULL,
	"unit_price" numeric(12, 2) NOT NULL,
	"moq" integer DEFAULT 1 NOT NULL,
	"unit" text NOT NULL,
	"stock_qty" integer DEFAULT 0 NOT NULL,
	"photo_url" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "orders" (
	"id" serial PRIMARY KEY NOT NULL,
	"buyer_id" integer NOT NULL,
	"supplier_id" integer NOT NULL,
	"product_id" integer NOT NULL,
	"quantity" integer NOT NULL,
	"total_amount" numeric(12, 2) NOT NULL,
	"platform_fee" numeric(12, 2) DEFAULT '0' NOT NULL,
	"status" "order_status" DEFAULT 'pending_supplier_confirmation' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"shipped_at" timestamp with time zone,
	"auto_release_at" timestamp with time zone,
	"delivery_location" text,
	"preferred_delivery_date" timestamp with time zone,
	"reject_reason" text,
	"expires_at" timestamp with time zone,
	"auto_release_reminder_sent" boolean DEFAULT false NOT NULL,
	"confirm_photo_url" text
);
--> statement-breakpoint
CREATE TABLE "transactions" (
	"id" serial PRIMARY KEY NOT NULL,
	"order_id" integer NOT NULL,
	"type" "transaction_type" NOT NULL,
	"moolre_reference" text,
	"status" text NOT NULL,
	"amount" numeric(12, 2) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ratings" (
	"id" serial PRIMARY KEY NOT NULL,
	"order_id" integer NOT NULL,
	"rater_id" integer NOT NULL,
	"ratee_id" integer NOT NULL,
	"stars" integer NOT NULL,
	"comment" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "dispute_replies" (
	"id" serial PRIMARY KEY NOT NULL,
	"dispute_id" integer NOT NULL,
	"author_id" integer NOT NULL,
	"message" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "disputes" (
	"id" serial PRIMARY KEY NOT NULL,
	"order_id" integer NOT NULL,
	"raised_by" integer NOT NULL,
	"reason" text NOT NULL,
	"status" "dispute_status" DEFAULT 'open' NOT NULL,
	"category" "dispute_category",
	"evidence_urls" text[],
	"resolution" text,
	"resolved_by_admin_id" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "admin_actions" (
	"id" serial PRIMARY KEY NOT NULL,
	"admin_id" integer NOT NULL,
	"order_id" integer NOT NULL,
	"action" "admin_action_type" NOT NULL,
	"details" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sms_logs" (
	"id" serial PRIMARY KEY NOT NULL,
	"phone" text NOT NULL,
	"template" text NOT NULL,
	"body" text NOT NULL,
	"order_id" integer,
	"status" text NOT NULL,
	"error_message" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "kyc_documents" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"doc_type" "kyc_doc_type" NOT NULL,
	"storage_url" text NOT NULL,
	"status" "kyc_doc_status" DEFAULT 'pending' NOT NULL,
	"uploaded_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_supplier_id_users_id_fk" FOREIGN KEY ("supplier_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_buyer_id_users_id_fk" FOREIGN KEY ("buyer_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_supplier_id_users_id_fk" FOREIGN KEY ("supplier_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ratings" ADD CONSTRAINT "ratings_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ratings" ADD CONSTRAINT "ratings_rater_id_users_id_fk" FOREIGN KEY ("rater_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ratings" ADD CONSTRAINT "ratings_ratee_id_users_id_fk" FOREIGN KEY ("ratee_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dispute_replies" ADD CONSTRAINT "dispute_replies_dispute_id_disputes_id_fk" FOREIGN KEY ("dispute_id") REFERENCES "public"."disputes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dispute_replies" ADD CONSTRAINT "dispute_replies_author_id_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "disputes" ADD CONSTRAINT "disputes_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "disputes" ADD CONSTRAINT "disputes_raised_by_users_id_fk" FOREIGN KEY ("raised_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "disputes" ADD CONSTRAINT "disputes_resolved_by_admin_id_users_id_fk" FOREIGN KEY ("resolved_by_admin_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "admin_actions" ADD CONSTRAINT "admin_actions_admin_id_users_id_fk" FOREIGN KEY ("admin_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "admin_actions" ADD CONSTRAINT "admin_actions_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sms_logs" ADD CONSTRAINT "sms_logs_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kyc_documents" ADD CONSTRAINT "kyc_documents_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;