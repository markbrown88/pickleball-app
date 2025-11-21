# Player `name` Field Usage Throughout the App

## Summary
The `player.name` field is used extensively throughout the application for displaying player names. Many places have fallbacks to `firstName + lastName`, but some directly use `name` without fallbacks.

## Key Usage Areas

### 1. **API Endpoints (Returning Player Data)**
- `src/app/api/auth/user/route.ts` - Returns `player.name` in user profile
- `src/app/api/player/profile/route.ts` - Returns `player.name` in profile data
- `src/app/api/players/[playerId]/overview/route.ts` - Returns `player.name`
- `src/app/api/admin/players/[playerId]/route.ts` - Returns `player.name`
- `src/app/api/admin/rosters/[tournamentId]/route.ts` - Returns `player.name ?? null`
- `src/app/api/admin/stops/[stopId]/rosters/route.ts` - Returns `player.name`
- `src/app/api/public/stops/[stopId]/scoreboard/route.ts` - Returns `player.name` for scoreboard

### 2. **Email Notifications**
- `src/server/email.ts` - Uses `player.name` in multiple email templates:
  - Payment receipts
  - Registration confirmations
  - Payment reminders
  - Refund notifications
  - Tournament invitations
  - Waitlist notifications

### 3. **Payment Processing**
- `src/app/api/webhooks/stripe/route.ts` - Uses `registration.player.name` for payment descriptions
- `src/app/api/payments/create-checkout-session/route.ts` - Uses `player.name` for Stripe checkout
- `src/app/api/payments/retry/route.ts` - Uses `player.name` for payment retry
- `src/app/api/payments/refund/route.ts` - Uses `registration.player.name` for refunds
- `src/app/api/registrations/route.ts` - Uses `playerDetails.name` for registration emails

### 4. **Registration System**
- `src/app/api/registrations/route.ts` - Uses `playerDetails.name` for email notifications
- `src/app/register/[tournamentId]/confirmation/page.tsx` - Displays `registration.player.name`

### 5. **Tournament Management**
- `src/app/tournaments/components/tabs/RegistrationsTab.tsx` - Displays `reg.player.name` in registration lists
- `src/app/tournaments/components/tabs/InvitePlayersTab.tsx` - Displays `player.name` in invite lists
- `src/app/api/admin/tournaments/[tournamentId]/registrations/[registrationId]/route.ts` - Uses `registration.player.name` in deletion messages

### 6. **Captain Portal**
- `src/app/captain/[token]/stop/[stopId]/page.tsx` - Uses `player.name` in dropdown selects for lineup creation
- `src/app/api/captain-portal/[token]/stop/[stopId]/bracket/[bracketId]/round/[roundId]/route.ts` - Uses `stp.player.name` with fallback: `nameParts.join(' ') || stp.player.name || 'Unknown'`

### 7. **Roster Management**
- `src/app/rosters/page.tsx` - Uses `p.name` with fallback: `parts.join(' ') || p.name || 'Unknown'`
- `src/app/api/admin/stops/[stopId]/teams/[teamId]/roster/route.ts` - Uses `stp.player.name` with fallback: `stp.player.name || firstName + lastName`

### 8. **Match/Lineup Management**
- `src/app/manager/components/TeamFormatManager/index.tsx` - Displays `player.name` in match lineups
- `src/app/manager/components/BracketMatchManager/BracketLineupEditor.tsx` - Displays `player.name` in lineup editors
- `src/app/manager/components/shared/InlineLineupEditor.tsx` - Displays `player.name` in inline editors
- `src/app/api/admin/rounds/[roundId]/teams/[teamId]/lineup/route.ts` - Uses `tp.player.name` with fallback

### 9. **Player Dashboard**
- `src/app/(player)/dashboard/payments/page.tsx` - Uses `p.player.name` for payment history

### 10. **Cron Jobs**
- `src/app/api/cron/payment-reminders/route.ts` - Uses `registration.player.name` for reminder emails

## Places with Fallbacks (Safe)
These locations construct names from firstName/lastName if name is missing:
- Captain portal roster (`nameParts.join(' ') || stp.player.name || 'Unknown'`)
- Roster page (`parts.join(' ') || p.name || 'Unknown'`)
- Admin roster API (`stp.player.name || firstName + lastName`)

## Places Without Fallbacks (Potentially Problematic)
These locations directly use `player.name` without fallbacks:
- Email notifications (may show null/empty)
- Payment descriptions (may show null/empty)
- Tournament registration lists (may show null/empty)
- Captain portal dropdowns (may show empty options)
- Scoreboard API (may show null)
- Admin roster API (returns `name ?? null`)

## Recommendation
All 6 players without name fields have both firstName and lastName, so they can be populated. The name field should be populated to ensure consistent display across all these areas.

