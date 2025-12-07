# Club Director Signup & Subscription - Final Implementation Plan

## Overview
This feature transforms the platform from a single-admin system to a distributed Club Director model.
- **Club Directors** can manage their own clubs and tournaments.
- **Participating Clubs (Free)** can be listed and join tournaments.
- **Subscribed Clubs (Paid)** can create and manage their own events.

---

## 🏗️ Phase 1: Database Schema & Migration (Week 1)
**Goal:** Establish the data model for multi-director clubs and subscriptions.

### 1.1 Schema Changes
```prisma
// 1. Rename existing registration model to indicate legacy
model LegacyClubRegistration { ... }

// 2. Club Model Updates
model Club {
  // Existing fields...
  // REMOVE: directorId (Replace with relation)
  
  // New Status Fields
  status              ClubStatus      @default(ACTIVE)
  subscriptionId      String?         // Stripe sub ID
  subscriptionStatus  SubscriptionStatus?
  
  // Relations
  directors           ClubDirector[]  // Many-to-many
  // ... existing relations
}

// 3. New Join Table for Directors
model ClubDirector {
  clubId    String
  playerId  String
  role      ClubRole @default(ADMIN)
  joinedAt  DateTime @default(now())

  club      Club     @relation(fields: [clubId], references: [id])
  player    Player   @relation(fields: [playerId], references: [id])
  
  @@id([clubId, playerId])
}

// 4. New Admin Settings Table (Singleton)
model SystemSettings {
  id                    String   @id @default("settings")
  monthlySubscriptionPrice Int   @default(6999) // cents
  annualSubscriptionPrice  Int   @default(79999) // cents
  isSubscriptionEnabled Boolean  @default(true)
}

enum ClubStatus {
  ACTIVE      // Free / Participating
  SUBSCRIBED  // Paid / Tournament Creator
  PAST_DUE    // Payment failed, grace period
}
```

### 1.2 Data Migration Script
- Create `ClubDirector` records for all existing clubs that have a `directorId` (if any).
- Set all existing clubs to `status: ACTIVE` (Free/Participating).
- **Manual Data Cleanup:** Delete or archive invalid `ClubRegistration` records if not needed.

---

## 💳 Phase 2: Stripe Subscription Infrastructure (Week 1-2)
**Goal:** Enable recurring billing and admin pricing controls.

### 2.1 Stripe Configuration
- Create `src/lib/stripe/subscription.ts`.
- Implement `createCheckoutSession` for **subscriptions** (mode: 'subscription').
- **Important:** Use dynamic prices from `SystemSettings` (Admin overrides) rather than hardcoded Stripe Price IDs if using "Price Data" mode, OR sync Admin settings to Stripe Products.
  - *Decision:* Use Stripe Products/Prices as source of truth, but allow Admin UI to update them via Stripe API.

### 2.2 Webhook Handling
- Listen for:
  - `customer.subscription.created`
  - `customer.subscription.updated`
  - `customer.subscription.deleted`
  - `invoice.payment_succeeded`
  - `invoice.payment_failed`
- Logic:
  - On success: Set Club `status = SUBSCRIBED`.
  - On failure: Set Club `status = PAST_DUE` (Grace period).
  - On cancel: Set Club `status = ACTIVE` (at period end).

### 2.3 Admin Pricing UI
- **Page:** `/admin/settings/pricing`
- **Features:**
  - View current Monthly/Annual prices.
  - Update prices (Updates Stripe Product/Price objects).
  - Toggle "Accepting New Subscriptions".

---

## 🧙 Phase 3: Club Signup Wizard (Week 2-3)
**Goal:** Replace legacy registration with a Director-driven flow.

### 3.1 Wizard Logic
**Page:** `/club-signup` (Protected Route)
1. **Step 1: Search Club**
   - User types club name.
   - List matches from DB.
   - **Action A: Claim** (Visible if `club.directors.length === 0`).
   - **Action B: Locked** (Visible if `club.directors.length > 0`). Show "Contact Support".
   - **Action C: Create New** (If not found).

2. **Step 2: Verification/Details**
   - Confirm Address, City, Logo.
   - If claiming: Update `ClubDirector` table linking current user.
   - If creating: Insert `Club` + `ClubDirector`.

3. **Step 3: Subscription (Optional)**
   - "Continue as Free Club" (Participating only).
   - "Upgrade to Tournament Director" ($69/mo or $799/yr).
   - Checkout Flow via Stripe.

---

## 🔒 Phase 4: Permissions & Gatekeeping (Week 3)
**Goal:** Enforce the "Pay to Create" model.

### 4.1 Permission Helpers
- `isClubDirector(userId, clubId)` verification.
- `canManageTournaments(clubId)` -> Checks `status === SUBSCRIBED`.

### 4.2 Middleware/Route Protection
- `/tournaments/new`: Block if user's club is not SUBSCRIBED.
- `/admin/tournaments/[id]`: Allow access if user is `ClubDirector` of `ownerClub`.

### 4.3 Tournament Inactivation Logic
- Background Job (Cron): Check for subscriptions that expired > 30 days ago.
- Action: Set `Tournament.status = INACTIVE` for upcoming events owned by that club.
- Notification: Email Director 7 days before inactivation.

---

## 👥 Phase 5: Additional Features (Week 4)

### 5.1 Multi-Director Invitation
- **Page:** `/club/[id]/settings/users`
- Allow existing Director to invite other users by email.
- They become `ClubDirector` entries.

### 5.2 Transaction & Refund Management
- **Page:** `/admin/transactions`
- Update UI to use existing `POST /api/payments/refund` logic.
- Add "Partial Refund" modal inputs (Amount field).

### 5.3 Player Invitations
- Allow Directors to invite players to join their club (link `Player.clubId` or `PlayerClub` relation).

---

## 📋 Critical Rules & Logic
1. **Claims:** A club with **zero** directors is claimable. A club with **>=1** directors is locked.
2. **Legacy Clean-up:** The old `/clubs/register` route will be 404'd or redirected to `/club-signup`.
3. **Refunds:** Partial refunds are supported via backend; UI needs to expose this.
4. **Data Hierarchy:** 
   - App Admin > Club Director > Tournament Admin.
   - App Admins can edit/access ANY club or tournament.

