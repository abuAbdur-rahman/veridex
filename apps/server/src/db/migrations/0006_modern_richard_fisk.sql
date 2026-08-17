ALTER TABLE "invites" DROP CONSTRAINT "invites_token_unique";--> statement-breakpoint
ALTER TABLE "invites" ADD COLUMN "token_hash" text NOT NULL;--> statement-breakpoint
ALTER TABLE "invites" ADD COLUMN "token_prefix" text NOT NULL;--> statement-breakpoint
ALTER TABLE "invites" DROP COLUMN "token";--> statement-breakpoint
ALTER TABLE "invites" ADD CONSTRAINT "invites_token_hash_unique" UNIQUE("token_hash");