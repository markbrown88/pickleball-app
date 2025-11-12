# Pickleplex Belleville First Stop Zero Points

## Overview
This implements a special case rule for the "KLYNG CUP - pickleplex" tournament where **Pickleplex Belleville teams receive 0 standing points for all matches played in the first stop** (Vaughn at Pickleplex Vaughn).

## Affected Teams
- **Pickleplex Belleville 2.5** (ID: `cmh7rtye50027l804cj7ys3n1`)
- **Pickleplex Belleville 3.0** (ID: `cmh7rtyf20029l804p07y42mt`)
- **Pickleplex Belleville 3.5** (ID: `cmh7rtyfz002bl804edtefv6x`)
- **Pickleplex Belleville 4.0+** (ID: `cmh7rtygv002dl804pgppig6o`)

## Technical Details
- **Tournament**: KLYNG CUP - pickleplex (`cmh7qeb1t0000ju04udwe7w8w`)
- **First Stop**: Vaughn (`cmh7rtx2x000hl804yn12dfw9`)
- **Club**: Pickleplex Belleville (`cmfwjxyqn0001rdxtr8v9fmdj`)
- **Affected Matches**: 28 matches in the first stop

## Implementation

### 1. Apply the Database Migration
Run the SQL script to modify the `tournament_standings` view:

```bash
psql $DATABASE_URL -f set-belleville-first-stop-zero.sql
```

Or manually execute in your database:
```bash
# If using Supabase SQL Editor, copy the contents of:
# set-belleville-first-stop-zero.sql
```

### 2. Verify the Change
After applying the migration, run:

```bash
node verify-belleville-zero-points.js
```

This will show the standings with Pickleplex Belleville teams marked.

## How It Works

The modified `tournament_standings` view now includes special case logic:

```sql
-- For Team A points
WHEN t.id = 'cmh7qeb1t0000ju04udwe7w8w'  -- KLYNG CUP - pickleplex
  AND s.id = 'cmh7rtx2x000hl804yn12dfw9'  -- First stop (Vaughn)
  AND ta."clubId" = 'cmfwjxyqn0001rdxtr8v9fmdj'  -- Pickleplex Belleville
THEN 0
```

### Important Notes

1. **First Stop Only**: This rule applies ONLY to the first stop (Vaughn). Pickleplex Belleville will earn points normally in all subsequent stops.

2. **Match Results Unchanged**: The actual match results (wins/losses/scores) remain unchanged. Only the standing points calculation is affected.

3. **Opponents Not Affected**: Teams playing against Pickleplex Belleville still earn their normal points (3 for win, 1 for loss in a close match, 0 for forfeit loss).

4. **Special Case Documentation**: The view includes a comment documenting this special case for future reference.

## Reverting the Change

If you need to remove this special case rule in the future, you can restore the original view by removing the special case conditions or running a migration that recreates the view without them.

## Questions?

This is a very specific business rule for this one tournament. If you have questions about why this was implemented or need to apply similar rules to other tournaments/stops, please document the requirements clearly.
