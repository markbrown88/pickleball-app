# Database Migration Required

## Problem
The `TournamentRegistration` table doesn't exist in your database, causing registration to fail with a 500 error.

## Solution

You need to run the migration SQL script in your Supabase database. Here are two options:

### Option 1: Use the Fixed Migration Script (Recommended)

I've created a safe migration script that checks if tables exist before creating them:

**File**: `migrations/fix-tournament-registration-tables.sql`

**Steps:**
1. Open your Supabase Dashboard: https://supabase.com/dashboard
2. Go to your project → SQL Editor
3. Copy and paste the contents of `migrations/fix-tournament-registration-tables.sql`
4. Click "Run" to execute the migration
5. Verify the tables were created successfully

### Option 2: Use the Original Migration (If tables don't exist)

**File**: `prisma/migrations/add_tournament_registration_system.sql`

**Note**: I've fixed this file to include `PAID` in the PaymentStatus enum.

**Steps:**
1. Open Supabase Dashboard → SQL Editor
2. Copy and paste the contents of `prisma/migrations/add_tournament_registration_system.sql`
3. Click "Run"
4. If you get errors about enums/tables already existing, use Option 1 instead

### After Running Migration

1. **Regenerate Prisma Client**:
   ```bash
   npx prisma generate
   ```

2. **Restart your dev server**:
   ```bash
   npm run dev
   ```

3. **Try registering again** - it should work now!

## What the Migration Creates

- **Enums**: RegistrationStatus, RegistrationType, RegistrationPlayerStatus, PaymentStatus, InviteStatus, InviteRequestStatus, WaitlistStatus
- **Tables**: 
  - TournamentRegistration (main registration table)
  - TournamentInvite
  - InviteRequest
  - TournamentWaitlist
- **Columns**: Adds registration fields to Tournament table
- **Indexes**: Performance indexes for queries
- **Foreign Keys**: Relationships between tables

## Verify Migration Success

After running the migration, you can verify in Supabase:
1. Go to Table Editor
2. You should see `TournamentRegistration` table
3. Check that it has columns: id, tournamentId, playerId, status, paymentStatus, etc.

## Troubleshooting

If you get errors:
- **"type already exists"**: The enum already exists, skip that part
- **"table already exists"**: Use Option 1 (the safe migration script)
- **"column already exists"**: Some columns might already be added, that's okay

The safe migration script (`fix-tournament-registration-tables.sql`) handles all these cases automatically.

