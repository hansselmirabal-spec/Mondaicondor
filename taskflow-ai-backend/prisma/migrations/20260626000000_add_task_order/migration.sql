-- Add order column to Task
ALTER TABLE "Task" ADD COLUMN "order" INTEGER NOT NULL DEFAULT 0;

-- Assign sequential order within each group based on createdAt
WITH ordered AS (
  SELECT id, ROW_NUMBER() OVER (PARTITION BY "groupId" ORDER BY "createdAt") - 1 AS rn
  FROM "Task"
)
UPDATE "Task" SET "order" = ordered.rn FROM ordered WHERE "Task".id = ordered.id;
