# DUPR Field Usage Analysis

## Current State
- **3 DUPR fields exist**: `dupr`, `duprSingles`, `duprDoubles`
- **General `dupr` field should be removed** - no single DUPR value exists

## Context Determination

### ✅ Can Determine Game Type (Singles vs Doubles):
1. **Lineup/Game Context**:
   - `Game.gameSlot` enum: `MENS_SINGLES`, `WOMENS_SINGLES` = use `duprSingles`
   - `Game.gameSlot` enum: `MENS_DOUBLES`, `WOMENS_DOUBLES`, `MIXED_1`, `MIXED_2` = use `duprDoubles`
   - `BracketGameTypeConfig.gameType` field
   - Round/lineup entries have game type context

2. **Player Stats/Games API**:
   - Can check `Game.gameSlot` to determine which DUPR to show

### ❌ Cannot Determine Game Type (Default to Doubles):
1. **Roster Page**:
   - Players shown per bracket
   - Brackets can have both singles AND doubles game types
   - **Solution**: Default to `duprDoubles` (most common)

2. **General Player Lists**:
   - Admin players page
   - Player search results
   - Team member lists
   - **Solution**: Default to `duprDoubles` or show both

3. **Lineup Generation**:
   - Uses DUPR for sorting players
   - May not have specific game type context
   - **Solution**: Default to `duprDoubles` for sorting

## Files That Need Updates

### Remove `dupr` field:
1. `prisma/schema.prisma` - Remove `dupr Float?` field
2. All API routes that return/accept `dupr`
3. All TypeScript types that include `dupr`
4. All frontend components that display/edit `dupr`

### Update to use context-aware DUPR:
1. **Lineup/Game contexts**: Use `duprSingles` for singles, `duprDoubles` for doubles
2. **Roster/General contexts**: Default to `duprDoubles`
3. **Player profile**: Already uses `duprSingles` and `duprDoubles` separately ✅

## Implementation Strategy

1. **Phase 1**: Update all code to use `duprDoubles` as default (where context unavailable)
2. **Phase 2**: Add context-aware logic for lineup/game displays
3. **Phase 3**: Remove `dupr` field from schema (requires migration)
4. **Phase 4**: Clean up all references to `dupr` field

