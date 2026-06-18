ALTER TABLE "Task" ADD COLUMN "createdBy" TEXT;

CREATE INDEX "Task_createdBy_idx" ON "Task"("createdBy");

ALTER TABLE "Task" ADD CONSTRAINT "Task_createdBy_fkey"
  FOREIGN KEY ("createdBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
