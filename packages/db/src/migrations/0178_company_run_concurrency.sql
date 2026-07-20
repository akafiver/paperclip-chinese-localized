ALTER TABLE "companies" ADD COLUMN IF NOT EXISTS "max_concurrent_runs" integer DEFAULT 2 NOT NULL;--> statement-breakpoint
ALTER TABLE "companies" ADD COLUMN IF NOT EXISTS "max_concurrent_runs_per_agent" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
UPDATE "companies"
SET
  "max_concurrent_runs" = 2,
  "max_concurrent_runs_per_agent" = 1
WHERE
  "max_concurrent_runs" IS NULL
  OR "max_concurrent_runs_per_agent" IS NULL;--> statement-breakpoint
