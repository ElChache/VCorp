-- Add lastNotifiedAt column to reading_assignments table to prevent notification spam
-- This allows the system to track when agents were last notified and only re-notify after 1 minute
ALTER TABLE "reading_assignments" ADD COLUMN "last_notified_at" timestamp;