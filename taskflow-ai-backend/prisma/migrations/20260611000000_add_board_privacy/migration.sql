ALTER TABLE "Board" ADD COLUMN "isPrivate" BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE "BoardMember" (
    "id" TEXT NOT NULL,
    "boardId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    CONSTRAINT "BoardMember_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "BoardMember_boardId_userId_key" ON "BoardMember"("boardId", "userId");
CREATE INDEX "BoardMember_boardId_idx" ON "BoardMember"("boardId");
CREATE INDEX "BoardMember_userId_idx" ON "BoardMember"("userId");

ALTER TABLE "BoardMember" ADD CONSTRAINT "BoardMember_boardId_fkey"
  FOREIGN KEY ("boardId") REFERENCES "Board"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "BoardMember" ADD CONSTRAINT "BoardMember_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
