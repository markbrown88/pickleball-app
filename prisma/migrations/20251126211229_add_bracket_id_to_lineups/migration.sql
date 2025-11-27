-- AlterTable
ALTER TABLE "Lineup" ADD COLUMN "bracketId" TEXT;

-- DropIndex (old unique constraint)
DROP INDEX IF EXISTS "Lineup_roundId_teamId_key";

-- CreateIndex (new unique constraint with bracketId)
CREATE UNIQUE INDEX "Lineup_roundId_teamId_bracketId_key" ON "Lineup"("roundId", "teamId", "bracketId");

-- CreateIndex (index on bracketId for performance)
CREATE INDEX "Lineup_bracketId_idx" ON "Lineup"("bracketId");

-- AddForeignKey (add relationship to TournamentBracket)
ALTER TABLE "Lineup" ADD CONSTRAINT "Lineup_bracketId_fkey" FOREIGN KEY ("bracketId") REFERENCES "TournamentBracket"("id") ON DELETE SET NULL ON UPDATE CASCADE;
