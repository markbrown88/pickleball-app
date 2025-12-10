# PlayerMergeLog Migration

Run this SQL in Supabase SQL Editor:

```sql
-- Migration: Add PlayerMergeLog table

CREATE TABLE IF NOT EXISTS "PlayerMergeLog" (
    "id" TEXT NOT NULL,
    "primaryPlayerId" TEXT NOT NULL,
    "secondaryPlayerId" TEXT NOT NULL,
    "secondaryPlayerName" TEXT NOT NULL,
    "secondaryPlayerEmail" TEXT,
    "secondaryClerkUserId" TEXT,
    "mergedBy" TEXT NOT NULL,
    "transferredData" JSONB,
    "clerkMergeStatus" TEXT,
    "clerkMergeNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PlayerMergeLog_pkey" PRIMARY KEY ("id")
);

-- Add foreign key constraints
ALTER TABLE "PlayerMergeLog" ADD CONSTRAINT "PlayerMergeLog_primaryPlayerId_fkey" 
    FOREIGN KEY ("primaryPlayerId") REFERENCES "Player"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "PlayerMergeLog" ADD CONSTRAINT "PlayerMergeLog_mergedBy_fkey" 
    FOREIGN KEY ("mergedBy") REFERENCES "Player"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS "PlayerMergeLog_primaryPlayerId_idx" ON "PlayerMergeLog"("primaryPlayerId");
CREATE INDEX IF NOT EXISTS "PlayerMergeLog_mergedBy_idx" ON "PlayerMergeLog"("mergedBy");
CREATE INDEX IF NOT EXISTS "PlayerMergeLog_createdAt_idx" ON "PlayerMergeLog"("createdAt");
```
