-- AlterTable
ALTER TABLE "player_profiles"
ADD COLUMN "rank_confirmed_at" TIMESTAMPTZ(3);

-- Existing users who already have a rank are considered confirmed.
UPDATE "player_profiles"
SET "rank_confirmed_at" = CURRENT_TIMESTAMP
WHERE "rank_tier" IS NOT NULL;