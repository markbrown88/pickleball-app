# Club Director Signup Feature - Implementation Plan

## Overview

This feature enables Pickleball Club Directors to sign up their clubs to the Klyng Cup platform. Clubs can operate in two tiers:
- **Free Tier (ACTIVE)**: Participate in tournaments created by others
- **Paid Tier (SUBSCRIBED)**: Create and manage their own tournaments ($69.99/month or $799.99/year)

---

## Phase 1: Database Schema Changes

### 1.1 Player Model Updates

Add explicit status field and multi-club support:

```prisma
// Add to Player model
status          PlayerStatus    @default(PROFILE_ONLY)
invitedByClubId String?         // Club that invited this pending player

// New enum
enum PlayerStatus {
  PENDING       // Invited by club, hasn't signed up yet
  PROFILE_ONLY  // Created manually, never logged in (no clerkUserId)
  REGISTERED    // Has logged in (has clerkUserId)
  DISABLED      // Account disabled by admin
}
```

### 1.2 Multi-Club Player Association

New join table for players belonging to multiple clubs:

```prisma
model PlayerClub {
  id        String            @id @default(cuid())
  playerId  String
  clubId    String
  status    PlayerClubStatus  @default(ACTIVE)
  isPrimary Boolean           @default(false)
  joinedAt  DateTime          @default(now())
  leftAt    DateTime?

  player    Player            @relation(fields: [playerId], references: [id], onDelete: Cascade)
  club      Club              @relation(fields: [clubId], references: [id], onDelete: Cascade)

  @@unique([playerId, clubId])
  @@index([clubId])
  @@index([playerId])
}

enum PlayerClubStatus {
  ACTIVE    // Currently a member
  INACTIVE  // Left or removed, but stats preserved
}
```

**Note:** Keep existing `Player.clubId` as the primary club. The new `PlayerClub` table tracks additional club memberships.

### 1.3 Club Model Updates

Add subscription and status fields:

```prisma
// Add to Club model
status              ClubStatus      @default(ACTIVE)
subscriptionId      String?         @unique  // Stripe subscription ID
subscriptionStatus  SubscriptionStatus?
trialEndsAt         DateTime?
currentPeriodEnd    DateTime?       // When current billing period ends
gracePeriodEnd      DateTime?       // 30 days after failed payment
cancelledAt         DateTime?       // When subscription was cancelled
stripeCustomerId    String?         @unique  // Stripe customer ID

// Relations
playerClubs         PlayerClub[]
clubInvites         ClubPlayerInvite[]
ownedTournaments    Tournament[]    @relation("TournamentOwnerClub")
subscriptionHistory ClubSubscriptionHistory[]

// Updated enums
enum ClubStatus {
  ACTIVE      // Free tier - can participate in tournaments
  SUBSCRIBED  // Paid tier - can create/manage tournaments
  TRIAL       // Trial period of paid subscription
  GRACE       // Payment failed, in 30-day grace period
  INACTIVE    // Subscription ended/cancelled (was previously SUBSCRIBED)
}

enum SubscriptionStatus {
  TRIALING
  ACTIVE
  PAST_DUE
  CANCELLED
  UNPAID
}
```

### 1.4 Club Subscription History

Track all subscription events:

```prisma
model ClubSubscriptionHistory {
  id              String    @id @default(cuid())
  clubId          String
  event           String    // created, renewed, cancelled, payment_failed, reactivated
  planType        String?   // monthly, annual
  amount          Int?      // in cents
  stripeEventId   String?
  createdAt       DateTime  @default(now())

  club            Club      @relation(fields: [clubId], references: [id], onDelete: Cascade)

  @@index([clubId])
}
```

### 1.5 Club Player Invitations

New model for club-initiated player invitations:

```prisma
model ClubPlayerInvite {
  id            String              @id @default(cuid())
  clubId        String
  invitedBy     String              // Player ID of director who invited
  email         String
  firstName     String?
  lastName      String?
  token         String              @unique @default(cuid())
  status        ClubInviteStatus    @default(PENDING)
  createdAt     DateTime            @default(now())
  expiresAt     DateTime            // 10 days from creation
  acceptedAt    DateTime?
  playerId      String?             // Linked when player signs up

  club          Club                @relation(fields: [clubId], references: [id], onDelete: Cascade)
  inviter       Player              @relation("ClubInvitesSent", fields: [invitedBy], references: [id])
  player        Player?             @relation("ClubInvitesReceived", fields: [playerId], references: [id])

  @@unique([clubId, email])
  @@index([email])
  @@index([token])
}

enum ClubInviteStatus {
  PENDING
  ACCEPTED
  EXPIRED
  CANCELLED
}
```

### 1.6 Tournament Model Updates

Add owner club field:

```prisma
// Add to Tournament model
ownerClubId     String?
status          TournamentStatus    @default(DRAFT)

ownerClub       Club?       @relation("TournamentOwnerClub", fields: [ownerClubId], references: [id])

// New enum
enum TournamentStatus {
  DRAFT
  PUBLISHED
  ACTIVE
  COMPLETED
  CANCELLED
  INACTIVE    // Club subscription lapsed
}
```

---

## Phase 2: Stripe Subscription Setup

### 2.1 Create Stripe Products

In Stripe Dashboard or via API:
- **Product:** "Klyng Cup Club Membership"
- **Prices:**
  - Monthly: $69.99 CAD (`price_monthly_xxxxx`)
  - Annual: $799.99 CAD (`price_annual_xxxxx`)
- **Trial:** 30 days (configured per checkout session)
- **Enable Stripe Tax** for automatic Canadian tax calculation

### 2.2 New Stripe Config

**File:** `src/lib/stripe/subscriptionConfig.ts`

```typescript
export const CLUB_SUBSCRIPTION_CONFIG = {
  productId: process.env.STRIPE_CLUB_PRODUCT_ID!,
  prices: {
    monthly: process.env.STRIPE_CLUB_MONTHLY_PRICE_ID!,
    annual: process.env.STRIPE_CLUB_ANNUAL_PRICE_ID!,
  },
  trialDays: 30,
  gracePeriodDays: 30,

  successUrl: (clubId: string) =>
    `${process.env.NEXT_PUBLIC_APP_URL}/club-signup/success?club_id=${clubId}`,
  cancelUrl: () =>
    `${process.env.NEXT_PUBLIC_APP_URL}/club-signup/cancelled`,
};
```

### 2.3 Webhook Events to Handle

Add to existing Stripe webhook handler:

```typescript
'customer.subscription.created'
'customer.subscription.updated'
'customer.subscription.deleted'
'customer.subscription.trial_will_end'  // 3 days before trial ends
'invoice.payment_succeeded'
'invoice.payment_failed'
```

---

## Phase 3: Homepage Club Signup Section

### 3.1 New Section Component

**File:** `src/components/home/ClubSignupSection.tsx`

**Location:** Insert before "What Makes Klyng Cup Different" section (line ~543 in page.tsx)

**Content:**
- Headline: "Run Your Club's Tournaments with Klyng Cup"
- 3-4 benefit bullets:
  - Manage your club profile and players
  - Run Round Robin & Double Elimination tournaments
  - Participate in regional and national Klyng Cup events
  - Track player statistics and rankings
- Pricing: "Starting at $69.99/month" with "1-month free trial"
- Note: "Free registration available for clubs that just want to participate"
- CTA Button: "Sign Up Your Club" → `/club-signup`

---

## Phase 4: Club Signup Wizard

### 4.1 Directory Structure

```
src/app/club-signup/
├── page.tsx                    # Main wizard page
├── ClubSignupFlow.tsx          # State management
├── components/
│   ├── ClubSignupStepper.tsx   # Step indicator
│   ├── ClubLookupStep.tsx      # Step 1: Search/Claim existing club
│   ├── ClubDetailsStep.tsx     # Step 2: Club information
│   ├── SubscriptionChoiceStep.tsx # Step 3: Free vs Paid choice
│   ├── PlanSelectionStep.tsx   # Step 3b: Plan selection (if paid)
│   └── ReviewStep.tsx          # Step 4: Review before payment
├── success/
│   └── page.tsx                # Post-payment/registration success
└── cancelled/
    └── page.tsx                # Payment cancelled
```

### 4.2 Wizard Flow

**Pre-requisite:** User must be logged in (Clerk). If not, show login prompt.

---

**Step 1: Club Lookup** (NEW)

Search for existing club:
- Autocomplete search field for club name
- Results show: Club Name, City, Director status

**Three outcomes:**

| Scenario | Action |
|----------|--------|
| Club exists, NO director, NOT subscribed | User can claim → Go to Step 2 (edit mode) |
| Club exists, HAS director | Show message: "This club is already registered with Klyng Cup by another member. Please contact support@klyng.ca for assistance." |
| Club not found | User creates new → Go to Step 2 (create mode) |

When claiming: User automatically becomes the Club Director (first-come-first-served).

---

**Step 2: Club Details**

Required fields:
- Club Name (fullName)
- Address Line 1 (address1)
- City
- Province/Region (dropdown)
- Postal Code
- Phone
- Email (pre-filled from director profile)
- Director (auto-filled, read-only)

If claiming existing club: Form pre-populated with existing data.

---

**Step 3: Subscription Choice** (NEW)

Two options presented:

**Option A: Free Registration**
- "Register your club to participate in Klyng Cup tournaments"
- Features:
  - Manage your club profile
  - View and invite players
  - Manage rosters for tournaments you participate in
  - Your own player profile
- Cost: Free
- CTA: "Complete Free Registration"

**Option B: Tournament Management Subscription**
- "Create and manage your own tournaments"
- Features: All free features, plus:
  - Create Round Robin & Double Elimination tournaments
  - Manage registrations
  - Full match control
- Cost: $69.99/month or $799.99/year
- 1-month free trial available
- CTA: "Continue to Plan Selection"

---

**Step 3b: Plan Selection** (Only if Option B chosen)

- Monthly: $69.99/month + tax
- Annual: $799.99/year + tax (save ~$40)
- Free Trial checkbox: "Start with 1-month free trial"
- Tax note: "Tax calculated at checkout based on your club's location"

---

**Step 4: Review & Complete**

**For Free Registration:**
- Summary of club details
- "Complete Registration" → Creates club with status=ACTIVE
- Redirect to success page

**For Paid Subscription:**
- Summary of club details and selected plan
- "Proceed to Payment" → Stripe Checkout (subscription mode)
- Card required upfront (even for trial)

---

**Success Page:**
- Club registered confirmation
- Show appropriate next steps based on tier:
  - Free: "Your club is ready to participate in tournaments!"
  - Paid: "Your club is ready to create tournaments!"
- CTA: "Go to Club Dashboard"

### 4.3 API Endpoints

**GET** `/api/clubs/search?q={query}`
- Public search for clubs by name
- Returns: id, fullName, city, hasDirector (boolean), status

**POST** `/api/club-signup/claim`
- Input: clubId
- Validates: club exists, no director, user is authenticated
- Sets current user as director
- Returns: clubId

**POST** `/api/club-signup/initiate`
- Input: clubDetails, tier ('free' | 'paid')
- Creates Club with status=ACTIVE (free) or status=PENDING (paid)
- If paid: Creates Stripe Customer for director
- Returns: clubId, stripeCustomerId (if paid)

**POST** `/api/club-signup/create-checkout-session`
- Input: clubId, planType ('monthly'|'annual'), withTrial
- Creates Stripe Checkout Session (subscription mode)
- Returns: checkout URL

---

## Phase 5: Club Director Permissions

### 5.1 Permission Matrix

| Feature | Free (ACTIVE) | Paid (SUBSCRIBED/TRIAL) | Grace Period |
|---------|---------------|-------------------------|--------------|
| Club Profile (edit own) | Yes | Yes | Yes |
| Player List (own club) | Yes | Yes | Yes |
| Invite Players | Yes | Yes | No |
| Own Player Profile | Yes | Yes | Yes |
| Tournament Rosters | Edit (own club teams) | Edit (own club teams) | View only |
| Tournament Setup | No | Yes | No |
| Tournament Registrations | No | Yes | No |
| Match Control | No | Yes | No |

### 5.2 Permission Helper

**File:** `src/lib/permissions/clubPermissions.ts`

```typescript
export async function getClubDirectorPermissions(playerId: string) {
  const clubs = await prisma.club.findMany({
    where: { directorId: playerId },
    select: { id: true, status: true }
  });

  return {
    isClubDirector: clubs.length > 0,
    clubIds: clubs.map(c => c.id),

    // Can participate (view rosters, invite players, etc.)
    activeClubIds: clubs.filter(c =>
      ['ACTIVE', 'SUBSCRIBED', 'TRIAL', 'GRACE'].includes(c.status)
    ).map(c => c.id),

    // Can create/manage tournaments
    subscribedClubIds: clubs.filter(c =>
      ['SUBSCRIBED', 'TRIAL'].includes(c.status)
    ).map(c => c.id),

    canCreateTournaments: clubs.some(c =>
      ['SUBSCRIBED', 'TRIAL'].includes(c.status)
    ),

    // Has at least one free-tier club that could upgrade
    hasUpgradeableClubs: clubs.some(c => c.status === 'ACTIVE'),
  };
}
```

### 5.3 Tournament Filtering for Club Directors

In admin tournament list queries, add filter:

```typescript
// If not App Admin, filter to owned tournaments (SUBSCRIBED clubs only)
if (!currentPlayer.isAppAdmin) {
  const permissions = await getClubDirectorPermissions(currentPlayer.id);
  whereClause.OR = [
    { ownerClubId: { in: permissions.subscribedClubIds } },
    { admins: { some: { playerId: currentPlayer.id } } },
    { eventManagers: { some: { playerId: currentPlayer.id } } },
  ];
}
```

**Pages affected (for tournament management):**
- `/admin/tournaments` (Setup) - Only SUBSCRIBED clubs
- `/registrations` - Only SUBSCRIBED clubs
- `/match-control` - Only SUBSCRIBED clubs

### 5.4 Roster Permissions for Club Directors (NEW)

Club Directors can edit rosters for tournaments their club participates in:

**Permission Logic:**
```typescript
// In roster API routes, check if user is club director for a participating club
const canEditRoster = (
  isAppAdmin ||
  isTournamentAdmin ||
  (isClubDirector && clubIsParticipating)
);
```

**Player Addition Restriction:**
When Club Director adds players to roster, restrict to their club's players:
```typescript
// In player search for roster addition
if (isClubDirector && !isAppAdmin && !isTournamentAdmin) {
  // Only show players where:
  // - Player.clubId = directorClubId (primary club), OR
  // - PlayerClub.clubId = directorClubId (secondary association)
  whereClause.OR = [
    { clubId: directorClubId },
    { playerClubs: { some: { clubId: directorClubId, status: 'ACTIVE' } } }
  ];
}
```

### 5.5 Tournament Creation by Club Director

When Club Director creates tournament:
- Must have SUBSCRIBED or TRIAL club status
- `ownerClubId` = their club (pre-selected if only one club)
- Auto-add director as TournamentAdmin
- TournamentAdmin field shows director name (editable only by App Admin)

### 5.6 Left Navigation Updates

**For Club Directors with ACTIVE (free) clubs:**

Add "Subscribe" button in left nav:
```
📋 My Club
   Club Profile
   Players
   Invite Players
   ─────────────
   ⭐ Subscribe  ← NEW (highlighted)
```

Clicking "Subscribe" takes them to `/club-signup/upgrade?club_id={clubId}` which shows the subscription options (Step 3b flow).

---

## Phase 6: Player Invitation System

### 6.1 Invitation Page

**File:** `src/app/admin/clubs/[clubId]/players/invite/page.tsx`

Features:
- Form: First Name, Last Name, Email (required)
- Bulk import: CSV upload (firstName, lastName, email)
- Pending invitations table with status, expiry countdown
- Actions: Resend, Cancel

**Access:** Both ACTIVE and SUBSCRIBED clubs (not GRACE or INACTIVE)

### 6.2 API Endpoints

**POST** `/api/admin/clubs/[clubId]/invites`
```typescript
// Input
{ firstName?: string, lastName?: string, email: string }

// Logic
1. Validate club director permission
2. Check club status is ACTIVE, SUBSCRIBED, or TRIAL (not GRACE/INACTIVE)
3. Check for duplicate invite
4. Check for existing player with email:
   - If exists with clerkUserId: Add to PlayerClub directly, send notification
   - If exists without clerkUserId: Create invite linking playerId
   - If not exists: Create PENDING Player record + invite
5. Generate token, set expiresAt = now + 10 days
6. Send invitation email
```

**POST** `/api/admin/clubs/[clubId]/invites/[inviteId]/resend`
- Reset expiresAt to now + 10 days
- Resend email

**DELETE** `/api/admin/clubs/[clubId]/invites/[inviteId]`
- Set status = CANCELLED

### 6.3 Invitation Email

**Function:** `sendClubPlayerInviteEmail()`

Content:
- "{Club Name} has invited you to join Klyng Cup!"
- Inviter name
- Benefits of joining
- Expiration warning (10 days)
- CTA: "Accept Invitation" → `/signup?invite={token}`

### 6.4 Signup with Invite Token

**URL:** `/signup?invite={token}` or modify existing signup flow

Flow:
1. Validate token (exists, not expired, status=PENDING)
2. Pre-fill form: firstName, lastName, email, clubId (read-only)
3. On successful signup:
   - Update invite status = ACCEPTED
   - Link Player to invite
   - Create/update PlayerClub record
   - Update Player.status = REGISTERED

---

## Phase 7: Subscription Management

### 7.1 Subscription UI

**Page:** `src/app/admin/clubs/[clubId]/subscription/page.tsx`

**For ACTIVE (free) clubs:**
- Show "Upgrade to Tournament Management" CTA
- List benefits of subscription
- Plan selection and payment flow

**For SUBSCRIBED/TRIAL clubs:**
Display:
- Current Plan (Monthly/Annual)
- Status badge (Trial/Active/Grace)
- Trial ends / Next billing date
- Amount due (with tax)
- Payment method (last 4 digits)
- Billing history table

Actions:
- Change Plan (opens Stripe billing portal)
- Update Payment Method (Stripe billing portal)
- Cancel Subscription (confirmation modal)

### 7.2 Stripe Billing Portal Integration

```typescript
const session = await stripe.billingPortal.sessions.create({
  customer: club.stripeCustomerId,
  return_url: `${APP_URL}/admin/clubs/${clubId}/subscription`,
});
// Redirect to session.url
```

### 7.3 Grace Period Handling

**Scheduled Job:** Daily check for expired grace periods

```typescript
// Find clubs where grace period ended
const expiredClubs = await prisma.club.findMany({
  where: {
    status: 'GRACE',
    gracePeriodEnd: { lt: new Date() }
  }
});

for (const club of expiredClubs) {
  // Update club to INACTIVE (not ACTIVE - they lose tournament management)
  await prisma.club.update({
    where: { id: club.id },
    data: { status: 'INACTIVE' }
  });

  // Set club's future tournaments to INACTIVE
  await prisma.tournament.updateMany({
    where: {
      ownerClubId: club.id,
      startDate: { gt: new Date() }
    },
    data: { status: 'INACTIVE' }
  });

  // Send deactivation email
  await sendClubDeactivatedEmail(club);
}
```

**Note:** INACTIVE means "was subscribed, now lapsed" - different from ACTIVE (free tier).

### 7.4 Subscription Emails

| Event | Email Function | Timing |
|-------|---------------|--------|
| Trial ending | `sendTrialEndingEmail` | 3 days before |
| Payment failed | `sendPaymentFailedEmail` | Immediately |
| Grace period started | `sendGracePeriodWarningEmail` | Immediately |
| Club deactivated | `sendClubDeactivatedEmail` | When grace ends |
| Subscription cancelled | `sendSubscriptionCancelledEmail` | On cancellation |
| Payment success | `sendPaymentSuccessEmail` | On renewal |

---

## Phase 8: Data Migration

### 8.1 Migration Script

```typescript
// 1. Add new columns with defaults
// 2. Backfill Player.status based on existing data
await prisma.$executeRaw`
  UPDATE "Player" SET status =
    CASE
      WHEN disabled = true THEN 'DISABLED'
      WHEN "clerkUserId" IS NOT NULL THEN 'REGISTERED'
      ELSE 'PROFILE_ONLY'
    END
`;

// 3. Create PlayerClub records for existing relationships
await prisma.$executeRaw`
  INSERT INTO "PlayerClub" (id, "playerId", "clubId", "isPrimary", status)
  SELECT gen_random_uuid(), id, "clubId", true, 'ACTIVE'
  FROM "Player"
  WHERE "clubId" IS NOT NULL
  ON CONFLICT DO NOTHING
`;

// 4. Set existing clubs to SUBSCRIBED (grandfathered - they get full access)
await prisma.club.updateMany({
  data: { status: 'SUBSCRIBED' }
});
```

---

## Phase 9: Environment Variables

```env
# Add to .env
STRIPE_CLUB_PRODUCT_ID=prod_xxxxx
STRIPE_CLUB_MONTHLY_PRICE_ID=price_xxxxx
STRIPE_CLUB_ANNUAL_PRICE_ID=price_xxxxx
```

---

## Implementation Order

### Week 1-2: Database & Foundation
- [ ] Schema migration (all new models/fields)
- [ ] Player status backfill
- [ ] Club permission helper functions
- [ ] Stripe products/prices setup

### Week 3-4: Club Signup Flow
- [ ] Homepage section component
- [ ] Club lookup/search functionality
- [ ] Club signup wizard (all steps including free/paid choice)
- [ ] Stripe subscription checkout integration
- [ ] Subscription webhook handlers
- [ ] Success/cancelled pages

### Week 5-6: Permissions & Filtering
- [ ] Tournament filtering for Club Directors
- [ ] Roster editing for Club Directors (with club restriction)
- [ ] Club profile editing for directors
- [ ] Subscription management page
- [ ] Stripe billing portal integration
- [ ] "Subscribe" button in left nav for free clubs

### Week 7-8: Player Invitations
- [ ] Club player invite UI
- [ ] Invite API endpoints
- [ ] Invitation email template
- [ ] Signup flow with invite token
- [ ] Bulk invite import

### Week 9-10: Polish
- [ ] Grace period cron job
- [ ] All subscription email templates
- [ ] Testing & bug fixes
- [ ] Documentation

---

## Summary of Key Decisions

| Item | Decision |
|------|----------|
| Directors per club | 1 (first-come-first-served, admin can change) |
| Club claiming | Auto-assign director if club has no director |
| Club already claimed | Show message to contact support@klyng.ca |
| Free tier status | ACTIVE |
| Paid tier status | SUBSCRIBED |
| Free trial | 1 month (for paid tier) |
| Grace period | 30 days (paid tier only) |
| Invite expiration | 10 days |
| Free tier invite limit | Unlimited |
| Tax handling | Stripe Tax (automatic) |
| Existing clubs | Grandfathered as SUBSCRIBED |
| Tournament ownership | Club + Director (both) |
| Roster editing | Club Directors can edit for participating tournaments |
| Roster player restriction | Club Directors limited to their club's players |
| Primary club | Keep existing field + join table for additional |
