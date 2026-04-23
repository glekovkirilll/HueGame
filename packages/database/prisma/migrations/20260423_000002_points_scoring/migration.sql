ALTER TABLE "RoomSettings"
ALTER COLUMN "startChips" SET DEFAULT 0;

UPDATE "RoomSettings"
SET "startChips" = 0;
