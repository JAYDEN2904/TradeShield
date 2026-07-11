-- Incremental KYC migration (safe on existing Trade Shield DB).
-- Does NOT touch the express-session "session" table.

DO $$ BEGIN
  CREATE TYPE "public"."kyc_status" AS ENUM('none', 'pending', 'approved', 'rejected');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "public"."kyc_doc_status" AS ENUM('pending', 'accepted', 'rejected');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "public"."kyc_doc_type" AS ENUM('ghana_card_front', 'ghana_card_back');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "kyc_status" "kyc_status" DEFAULT 'none' NOT NULL;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "kyc_submitted_at" timestamp with time zone;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "kyc_reviewed_at" timestamp with time zone;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "kyc_rejection_reason" text;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "ghana_card_number" text;

CREATE TABLE IF NOT EXISTS "kyc_documents" (
  "id" serial PRIMARY KEY NOT NULL,
  "user_id" integer NOT NULL REFERENCES "users"("id"),
  "doc_type" "kyc_doc_type" NOT NULL,
  "storage_url" text NOT NULL,
  "status" "kyc_doc_status" DEFAULT 'pending' NOT NULL,
  "uploaded_at" timestamp with time zone DEFAULT now() NOT NULL
);
