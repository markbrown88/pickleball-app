# Migration Plan: Remove `dupr` Field

## Overview
Remove the general `dupr` field from the Player model since there is no single DUPR value. Use `duprSingles` for singles games and `duprDoubles` for doubles games.

## Status
✅ **Code Updated**: All API routes now use `duprDoubles` instead of `dupr`
✅ **Schema Updated**: `dupr` field removed from `prisma/schema.prisma`
⏳ **Migration Pending**: Database migration needs to be run

## Steps to Complete Migration

### 1. Analyze Current Data
Run the analysis script to check for data that needs migration:
```bash
npx tsx scripts/remove-dupr-field.ts
```

### 2. Migrate Data (if needed)
If the script shows players with `dupr` but no `duprDoubles`, run this SQL:
```sql
UPDATE "Player" 
SET "duprDoubles" = "dupr" 
WHERE "dupr" IS NOT NULL AND "duprDoubles" IS NULL;
```

### 3. Create and Run Migration
```bash
npx prisma migrate dev --name remove_dupr_field
```

### 4. Verify Migration
- Check that the migration was successful
- Verify no players lost DUPR data
- Test the application to ensure everything works

## Code Changes Summary

### API Routes Updated:
- ✅ `src/app/api/admin/players/route.ts` - Uses `duprDoubles`, maps to `dupr` in response
- ✅ `src/app/api/admin/players/[playerId]/route.ts` - Removed `dupr` from create/update
- ✅ `src/app/api/admin/rosters/[tournamentId]/route.ts` - Uses `duprDoubles`
- ✅ `src/app/api/admin/rounds/[roundId]/lineups/route.ts` - Uses `duprDoubles` for sorting
- ✅ `src/app/api/admin/rounds/[roundId]/generate-lineups/route.ts` - Uses `duprDoubles`
- ✅ `src/app/api/player/games/route.ts` - Uses `duprDoubles` (GameSlot only has doubles)
- ✅ `src/app/api/player/stats/route.ts` - Uses `duprDoubles`
- ✅ `src/app/api/players/[playerId]/overview/route.ts` - Maps `duprDoubles` to `dupr`
- ✅ `src/app/api/auth/user/route.ts` - Removed `dupr` from create/update, maps in response
- ✅ `src/app/api/player/profile/route.ts` - Maps `duprDoubles` to `dupr`
- ✅ All other roster/team API routes updated

### Context-Aware Logic:
- **Games/Lineups**: Since `GameSlot` enum only includes doubles types (MENS_DOUBLES, WOMENS_DOUBLES, MIXED_1, MIXED_2), all games use `duprDoubles`
- **Rosters**: Default to `duprDoubles` (brackets can have both singles and doubles)
- **General Lists**: Default to `duprDoubles`

### Backward Compatibility:
- API responses still include `dupr` field mapped from `duprDoubles` for frontend compatibility
- Frontend components don't need immediate changes
- TypeScript types can keep `dupr` field temporarily

## Future Cleanup (After Migration)
1. Remove `dupr` field from TypeScript types
2. Remove `dupr` mapping from API responses
3. Update frontend components to use `duprDoubles` directly
4. Add context-aware display logic where game type is known

