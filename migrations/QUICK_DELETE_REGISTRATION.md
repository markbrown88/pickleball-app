# Quick Delete Registration - Testing Guide

## Option 1: SQL Script (Fastest)

Run this SQL in Supabase SQL Editor:

```sql
-- Delete by Tournament ID and Player Email (easiest)
DELETE FROM "TournamentRegistration"
WHERE "tournamentId" = 'YOUR_TOURNAMENT_ID'
  AND "playerId" IN (
    SELECT id FROM "Player" WHERE email = 'player@example.com'
  );
```

**Steps:**
1. Open Supabase Dashboard → SQL Editor
2. Replace `YOUR_TOURNAMENT_ID` with the actual tournament ID
3. Replace `player@example.com` with the player's email
4. Run the query

## Option 2: API Endpoint (From Browser Console)

Open browser console on `/tournaments` page and run:

```javascript
// First, get the registration ID from the registrations list
// Then delete it:
fetch('/api/admin/tournaments/YOUR_TOURNAMENT_ID/registrations/YOUR_REGISTRATION_ID', {
  method: 'DELETE'
})
.then(r => r.json())
.then(console.log);
```

## Option 3: List All Registrations First

Run this SQL to see all registrations and find the one you want:

```sql
SELECT 
  tr.id as registration_id,
  tr."tournamentId",
  t.name as tournament_name,
  tr."playerId",
  p.name as player_name,
  p.email as player_email,
  tr.status,
  tr."paymentStatus",
  tr."registeredAt"
FROM "TournamentRegistration" tr
JOIN "Tournament" t ON t.id = tr."tournamentId"
JOIN "Player" p ON p.id = tr."playerId"
WHERE t.name ILIKE '%your tournament name%'  -- Optional: filter by tournament name
ORDER BY tr."registeredAt" DESC;
```

Then use the `registration_id` in Option 1 or 2.

## Option 4: Delete All Registrations for a Tournament

⚠️ **Use with caution!** This deletes ALL registrations:

```sql
DELETE FROM "TournamentRegistration" 
WHERE "tournamentId" = 'YOUR_TOURNAMENT_ID';
```

