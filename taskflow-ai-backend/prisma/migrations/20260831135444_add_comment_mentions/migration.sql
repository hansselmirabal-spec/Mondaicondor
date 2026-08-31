-- AlterTable
ALTER TABLE "Comment" ADD COLUMN     "mentionedUserIds" JSONB NOT NULL DEFAULT '[]';
