-- Add nullable image document id to Conversation for group avatars.
-- Prisma enums are not recreated because adding a column does not require a generator diff.
ALTER TABLE "Conversation" ADD COLUMN "imageDocumentId" TEXT;
CREATE UNIQUE INDEX "Conversation_imageDocumentId_key" ON "Conversation"("imageDocumentId");
ALTER TABLE "Conversation" ADD CONSTRAINT "Conversation_imageDocumentId_fkey" FOREIGN KEY ("imageDocumentId") REFERENCES "Document"("id") ON DELETE SET NULL ON UPDATE CASCADE;