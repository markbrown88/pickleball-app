# Tournament Registration System - Complete Specification

## Overview
This document outlines the complete tournament registration and player management system, including workflows, database changes, UI components, and email communications.

---

## 1. Database Schema Changes

### 1.1 Tournament Model Updates

```prisma
model Tournament {
  // ... existing fields ...

  // Registration Settings
  registrationStatus     RegistrationStatus @default(CLOSED)
  registrationType       RegistrationType   @default(FREE)
  registrationCost       Int?               // in cents, null if free
  maxPlayers            Int?               // null = unlimited

  // Restrictions (informational only)
  restrictionNotes      String[]           // Array of restriction messages

  // Waitlist
  isWaitlistEnabled     Boolean           @default(true)

  // Relations
  registrations         TournamentRegistration[]
  invites              TournamentInvite[]
  waitlist             TournamentWaitlist[]
}

enum RegistrationStatus {
  OPEN              // Anyone can register
  INVITE_ONLY       // Only invited players can register
  CLOSED            // No new registrations
}

enum RegistrationType {
  FREE
  PAID
}
```

### 1.2 New Models

```prisma
model TournamentRegistration {
  id                String   @id @default(cuid())
  tournamentId      String
  playerId          String

  status            RegistrationPlayerStatus @default(REGISTERED)
  registeredAt      DateTime @default(now())
  cancelledAt       DateTime?
  rejectedAt        DateTime?
  rejectionReason   String?  // Required if rejected

  // Payment
  paymentStatus     PaymentStatus @default(PENDING)
  paymentId         String?      // Stripe payment ID
  refundId          String?      // Stripe refund ID
  amountPaid        Int?         // in cents

  tournament        Tournament @relation(fields: [tournamentId], references: [id], onDelete: Cascade)
  player            Player     @relation(fields: [playerId], references: [id], onDelete: Cascade)

  @@unique([tournamentId, playerId])
  @@index([tournamentId, status])
  @@index([playerId])
}

enum RegistrationPlayerStatus {
  REGISTERED        // Active registration
  CANCELLED         // Player cancelled
  REJECTED          // Admin rejected
}

enum PaymentStatus {
  PENDING          // Payment not yet processed
  PAID             // Payment successful
  REFUNDED         // Payment refunded
  FAILED           // Payment failed
}

model TournamentInvite {
  id                String   @id @default(cuid())
  tournamentId      String
  playerId          String?  // null if inviting by email (not yet a player)

  // For email invites (player doesn't exist yet)
  inviteEmail       String?
  inviteName        String?
  inviteToken       String?  @unique // For signup link

  status            InviteStatus @default(PENDING)
  invitedBy         String   // Player ID of admin who sent invite
  invitedAt         DateTime @default(now())
  expiresAt         DateTime // Admin-selected expiry

  acceptedAt        DateTime?
  declinedAt        DateTime?
  cancelledAt       DateTime?

  tournament        Tournament @relation(fields: [tournamentId], references: [id], onDelete: Cascade)
  player            Player?    @relation(fields: [playerId], references: [id], onDelete: Cascade)
  inviter           Player     @relation("InvitesSent", fields: [invitedBy], references: [id])

  @@index([tournamentId, status])
  @@index([playerId])
  @@index([inviteEmail])
  @@index([inviteToken])
}

enum InviteStatus {
  PENDING          // Sent, awaiting response
  ACCEPTED         // Player accepted
  DECLINED         // Player declined
  CANCELLED        // Admin cancelled
  EXPIRED          // Passed expiry date
}

model InviteRequest {
  id                String   @id @default(cuid())
  tournamentId      String
  playerId          String

  status            InviteRequestStatus @default(PENDING)
  requestedAt       DateTime @default(now())
  reviewedAt        DateTime?
  reviewedBy        String?  // Player ID of admin who reviewed

  tournament        Tournament @relation(fields: [tournamentId], references: [id], onDelete: Cascade)
  player            Player     @relation(fields: [playerId], references: [id], onDelete: Cascade)
  reviewer          Player?    @relation("ReviewedRequests", fields: [reviewedBy], references: [id])

  @@unique([tournamentId, playerId])
  @@index([tournamentId, status])
}

enum InviteRequestStatus {
  PENDING          // Awaiting admin review
  ACCEPTED         // Admin accepted (player moved to registration)
  DECLINED         // Admin declined
}

model TournamentWaitlist {
  id                String   @id @default(cuid())
  tournamentId      String
  playerId          String

  position          Int      // Auto-calculated based on joinedAt
  joinedAt          DateTime @default(now())

  status            WaitlistStatus @default(ACTIVE)
  notifiedAt        DateTime?     // When spot-available email was sent
  notificationExpiresAt DateTime? // 24h after notifiedAt

  movedToRegisteredAt DateTime?
  removedAt         DateTime?

  tournament        Tournament @relation(fields: [tournamentId], references: [id], onDelete: Cascade)
  player            Player     @relation(fields: [playerId], references: [id], onDelete: Cascade)

  @@unique([tournamentId, playerId])
  @@index([tournamentId, status, position])
}

enum WaitlistStatus {
  ACTIVE           // On waitlist
  NOTIFIED         // Spot available, waiting for response
  EXPIRED          // Didn't respond in 24h
  REGISTERED       // Moved to registered
  REMOVED          // Manually removed or player withdrew
}
```

---

## 2. Player Dashboard

### 2.1 Layout

```
┌─────────────────────────────────────────────────┐
│  Player Dashboard                               │
│  [Upcoming Tournaments] [Past Tournaments]      │
├─────────────────────────────────────────────────┤
│                                                 │
│  ┌─ Tournament Card ─────────────────────────┐ │
│  │ 🏆 Summer Championship 2025               │ │
│  │ 📍 Downtown Sports Complex, Seattle       │ │
│  │ 📅 June 15-17, 2025                       │ │
│  │ 🎯 Team Format                            │ │
│  │ 🏅 Beginner, Intermediate                 │ │
│  │                                            │ │
│  │ 💰 $45 per player                         │ │
│  │ 👥 24/32 players registered (8 spots)     │ │
│  │                                            │ │
│  │ ⚠️ Restrictions:                          │ │
│  │ • Must be 18+ years old                   │ │
│  │ • Skill level 3.0 or higher recommended   │ │
│  │                                            │ │
│  │ Status: [🟢 Open for Registration]       │ │
│  │                                            │ │
│  │ [Register Now]                            │ │
│  └────────────────────────────────────────────┘ │
│                                                 │
└─────────────────────────────────────────────────┘
```

### 2.2 Tournament Card Status Matrix

| Registration Status | Player State | Badge | Primary Action | Secondary Action |
|-------------------|--------------|-------|----------------|------------------|
| **OPEN** | Not registered, spots available | 🟢 Open | [Register Now] | - |
| **OPEN** | Not registered, full | 🟡 Full | [Join Waitlist] | - |
| **OPEN** | Registered | ✅ Registered | [View Details] | [Cancel Registration] |
| **OPEN** | On waitlist (#3) | 🟡 Waitlist #3 | - | [Leave Waitlist] |
| **OPEN** | Waitlist notified | 🔥 Spot Available! | [Register Now] (24h timer) | - |
| **INVITE_ONLY** | No invite | 🔵 Invite Only | [Request Invite] | - |
| **INVITE_ONLY** | Invite pending | 🟣 Invited | [Accept Invite] | [Decline Invite] |
| **INVITE_ONLY** | Request pending | 🔵 Requested | "Awaiting admin review" | [Cancel Request] |
| **INVITE_ONLY** | Registered | ✅ Registered | [View Details] | [Cancel Registration] |
| **CLOSED** | Any | 🔴 Closed | "Registration closed" | - |

---

## 3. Registration Workflows

### 3.1 Admin Invites Player (Exists in DB)

```
FLOW:
1. Admin → Tournament Admin Panel → "Invite Players" tab
2. Admin searches/selects player(s) → Sets expiry date → Clicks "Send Invite"
3. System creates TournamentInvite record (status: PENDING)
4. Email sent to player: "You're invited to {Tournament}"

PLAYER EXPERIENCE:
5. Player clicks email link → Logs in → Taken to Dashboard
6. Tournament card shows: 🟣 "Accept Invite" button
7. Player clicks "Accept Invite"
   - FREE: Modal confirms → Status: REGISTERED → Email confirmation sent
   - PAID: Redirected to Stripe checkout → After payment → REGISTERED → Email sent
8. Admin receives email: "{Player} accepted invite to {Tournament}"
```

### 3.2 Admin Invites Player (Email Only)

```
FLOW:
1. Admin → "Invite Players" → Enters email + name → Sets expiry → "Send Invite"
2. System creates TournamentInvite (inviteEmail, inviteName, inviteToken)
3. Email sent: "You're invited! Create your account to join {Tournament}"

PLAYER EXPERIENCE:
4. Player clicks link → Signup page (email/name pre-filled, token in URL)
5. Player completes signup → Account created
6. Redirected to Dashboard → Tournament shows with "Accept Invite"
7. (Same as 3.1 from step 7)
```

### 3.3 Player Self-Registers (Open)

```
FLOW:
1. Player on Dashboard → Sees tournament with 🟢 "Register Now"
2. Clicks "Register Now"
   - FREE: Modal "Confirm registration?" → Yes → REGISTERED → Email sent
   - PAID: Stripe checkout → After payment → REGISTERED → Email sent
3. Admin receives email: "{Player} registered for {Tournament}"
4. Admin can review player profile → Accept or Reject
```

### 3.4 Player Requests Invite (Invite Only)

```
FLOW:
1. Player → Tournament card shows 🔵 "Request Invite"
2. Clicks "Request Invite" → Status: "Requested" (InviteRequest created)
3. Admin receives email: "{Player} requested invite to {Tournament}"
4. Admin → "Invite Requests" tab → Sees player with [Accept] [Decline]
5a. Admin clicks [Accept]:
    - System creates TournamentInvite (status: ACCEPTED)
    - Player receives email: "Your invite request was accepted!"
    - Player Dashboard shows "Accept Invite" button
    - (Continue as 3.1 step 7)
5b. Admin clicks [Decline]:
    - InviteRequest status: DECLINED
    - Player receives email: "Your invite request was not accepted at this time."
    - Dashboard shows: "Invite request declined"
```

### 3.5 Player Joins Waitlist

```
FLOW:
1. Tournament is full (registered >= maxPlayers)
2. Player → Tournament card shows 🟡 "Join Waitlist"
3. Clicks "Join Waitlist" → TournamentWaitlist record created
4. Player sees: "You're #3 on the waitlist"
5. Player receives email: "You've joined the waitlist for {Tournament}"

WHEN SPOT OPENS:
6. System auto-calculates next person (status: ACTIVE, lowest position)
7. Updates their status to NOTIFIED, sets notificationExpiresAt (24h)
8. Email sent: "A spot opened in {Tournament}! Register now (link valid 24h)"
9a. Player clicks link within 24h → Redirects to registration flow
9b. Player doesn't respond in 24h → Status: EXPIRED → Next person notified
```

### 3.6 Player Cancels Registration

```
FLOW:
1. Player Dashboard → Registered tournament shows [Cancel Registration]
2. Clicks "Cancel" → Modal: "Are you sure? You'll lose your spot."
3. Confirms cancellation:
   - FREE: Status → CANCELLED, cancelledAt set
   - PAID: Trigger Stripe refund → After refund → Status CANCELLED
4. Player receives email: "Registration cancelled. Refund processed (if paid)."
5. Admin receives email: "{Player} cancelled registration for {Tournament}"
6. If waitlist exists → System notifies next person (see 3.5 step 6)
```

### 3.7 Admin Rejects Registration

```
FLOW:
1. Admin → "Registered Players" tab → [Reject] button
2. Modal: "Reason for rejection: [text field]" (required)
3. Confirms rejection:
   - Status → REJECTED, rejectionReason saved
   - If PAID: Trigger Stripe refund
4. Player receives email: "Registration rejected. Reason: {rejectionReason}. Refund processed."
5. If waitlist exists → Next person notified
```

---

## 4. Tournament Admin Management Panel

### 4.1 Layout

```
Tournament: Summer Championship 2025
Settings: Open | $45/player | 32 max | 24 registered | 8 waitlist

[Registered] [Pending Invites] [Invite Requests] [Waitlist] [⚙️ Settings]

┌─ Registered Players (24) ────────────────────────────────┐
│ Name          Email         Registered  Paid  Actions    │
│ John Doe      john@...      2d ago      ✅    [View][✕] │
│ Jane Smith    jane@...      1w ago      ✅    [View][✕] │
│ ...                                                       │
│                                                           │
│ [+ Invite Players]                                        │
└───────────────────────────────────────────────────────────┘

┌─ Pending Invites (5) ─────────────────────────────────────┐
│ Name/Email       Invited    Expires     Actions           │
│ Mike Johnson     2d ago     in 5d       [Resend][Cancel]  │
│ sarah@email.com  1w ago     in 2h       [Resend][Cancel]  │
└───────────────────────────────────────────────────────────┘

┌─ Invite Requests (3) ─────────────────────────────────────┐
│ Name          Requested    Actions                        │
│ Tom Brown     1h ago       [View Profile][Accept][Decline]│
│ Lisa White    3h ago       [View Profile][Accept][Decline]│
└───────────────────────────────────────────────────────────┘

┌─ Waitlist (8) ────────────────────────────────────────────┐
│ Position  Name        Added     Status      Actions       │
│ #1        Amy Green   2h ago    Notified    [Register][Remove]│
│ #2        Bob Blue    1d ago    Active      [Register][Remove]│
└───────────────────────────────────────────────────────────┘
```

### 4.2 Invite Players Modal

```
┌─ Invite Players ──────────────────────────────────┐
│                                                   │
│ [○ Select existing players] [○ Invite by email]  │
│                                                   │
│ IF SELECTING EXISTING:                            │
│   [Search players...]                             │
│   [x] John Doe (john@email.com)                   │
│   [x] Jane Smith (jane@email.com)                 │
│   [ ] Mike Johnson (mike@email.com)               │
│                                                   │
│ IF INVITING BY EMAIL:                             │
│   Enter one per line or comma-separated:          │
│   ┌──────────────────────────────────────────┐   │
│   │ john@email.com, John Doe                 │   │
│   │ jane@email.com, Jane Smith               │   │
│   └──────────────────────────────────────────┘   │
│                                                   │
│ Invitation expires:                               │
│   [Date picker: June 15, 2025] [Time: 11:59 PM]  │
│                                                   │
│ [Cancel] [Send Invitations]                       │
└───────────────────────────────────────────────────┘
```

---

## 5. Tournament Setup Page Updates

### 5.1 New Tab: "Registration Settings"

Add this between "Tournament Details" and "Location(s) & Dates":

```
Tab: Registration Settings

┌─ Registration Settings ───────────────────────────────────┐
│                                                            │
│ Registration Status                                        │
│ ○ Open for Registration                                   │
│ ○ Invite Only                                             │
│ ○ Closed                                                  │
│                                                            │
│ Registration Type                                          │
│ ○ Free                                                    │
│ ○ Paid                                                    │
│                                                            │
│ [IF PAID]                                                 │
│ Registration Cost (per player)                            │
│ $ [45.00]                                                 │
│                                                            │
│ Player Limit                                              │
│ Max Players: [32] (leave blank for unlimited)            │
│                                                            │
│ [ ] Enable Waitlist                                       │
│   └─ (Only shown if max players is set)                  │
│                                                            │
│ Restrictions & Requirements                               │
│ (These are informational only - you can reject            │
│  registrations that don't meet criteria)                  │
│                                                            │
│ • Must be 18+ years old                      [Remove]     │
│ • Skill level 3.0 or higher recommended      [Remove]     │
│                                                            │
│ [+ Add Restriction]                                       │
│                                                            │
└────────────────────────────────────────────────────────────┘
```

---

## 6. Email Templates

### 6.1 Invite Sent (Existing Player)

```
Subject: You're invited to {Tournament Name}!

Hi {Player First Name},

You've been invited to participate in {Tournament Name}!

📅 Dates: {Start Date} - {End Date}
📍 Location: {Location Name}
💰 Cost: {Free or $XX per player}

{IF RESTRICTIONS}
⚠️ Please note:
• {Restriction 1}
• {Restriction 2}
{END IF}

[Accept Invitation] button (magic link)

This invitation expires on {Expiry Date}.

Questions? Contact {Admin Name} at {Admin Email}

---
You received this email because {Admin Name} invited you to this tournament.
```

### 6.2 Invite Sent (New Player)

```
Subject: You're invited to join {Tournament Name}!

Hi {Invite Name},

{Admin Name} has invited you to participate in {Tournament Name}!

To accept this invitation, you'll need to create a free account first:

[Create Account & Accept Invitation] button

Tournament Details:
📅 {Start Date} - {End Date}
📍 {Location Name}
💰 {Free or $XX per player}

{IF RESTRICTIONS}
⚠️ Requirements:
• {Restriction 1}
{END IF}

This invitation expires on {Expiry Date}.

---
Questions? Contact {Admin Name} at {Admin Email}
```

### 6.3 Registration Confirmed

```
Subject: You're registered for {Tournament Name}!

Hi {Player First Name},

Great news! You're officially registered for {Tournament Name}.

Tournament Details:
📅 {Start Date} - {End Date}
📍 {Location Name}, {Address}
🎯 Format: {Tournament Type}

{IF PAID}
💳 Payment Confirmation: ${Amount} paid
{END IF}

What's Next:
• Check your dashboard for updates
• Tournament schedule will be posted {X days} before the event
• Bring your paddle and a positive attitude!

[View Tournament Details] button
[Add to Calendar] button

Need to cancel? You can cancel your registration from your dashboard.

---
See you on the court!
{Admin Name}
```

### 6.4 Player Registered (to Admin)

```
Subject: New registration for {Tournament Name}

Hi {Admin Name},

{Player Name} just registered for {Tournament Name}!

Player Details:
Name: {First} {Last}
Email: {Email}
Phone: {Phone}
Skill Level: {DUPR or self-reported}
Club: {Primary Club}

{IF PAID}
Payment Status: ✅ Paid (${Amount})
{END IF}

Current Registration Count: {X} / {Max}

[View Player Profile] button
[View All Registrations] button

---
Manage registrations from your tournament admin panel.
```

### 6.5 Invite Request Received (to Admin)

```
Subject: {Player Name} requested to join {Tournament Name}

Hi {Admin Name},

{Player Name} has requested an invitation to {Tournament Name}.

Player Details:
Name: {First} {Last}
Email: {Email}
Skill Level: {DUPR}
Club: {Primary Club}

[View Profile & Accept] button
[Decline Request] button

Current Registration: {X} / {Max}
Pending Requests: {Y}

---
Review and respond to invite requests from your admin panel.
```

### 6.6 Waitlist Spot Available

```
Subject: A spot opened in {Tournament Name}!

Hi {Player First Name},

Great news! A spot just opened up in {Tournament Name}.

You're next on the waitlist, so you have the first chance to register!

⏰ Act fast - this offer expires in 24 hours ({Expiry DateTime})

Tournament Details:
📅 {Start Date} - {End Date}
📍 {Location}
💰 {Cost}

[Register Now] button (magic link, 24h expiry)

If you don't register within 24 hours, the spot will be offered to the next person on the waitlist.

---
Questions? Reply to this email.
```

### 6.7 Registration Rejected (to Player)

```
Subject: Update on your registration for {Tournament Name}

Hi {Player First Name},

We're writing to let you know that your registration for {Tournament Name} was not accepted.

Reason: {Rejection Reason from Admin}

{IF PAID}
A full refund of ${Amount} has been processed and should appear in your account within 5-7 business days.
{END IF}

We appreciate your interest and hope you'll join us for future tournaments!

---
Questions? Contact {Admin Email}
```

### 6.8 Other Templates

Similar structure for:
- Invite Accepted (to Admin)
- Invite Request Accepted (to Player)
- Invite Request Declined (to Player)
- Cancellation Confirmed (to Player)
- Player Cancelled (to Admin)
- Waitlist Joined (to Player)
- Waitlist Expired (to Player)

---

## 7. API Endpoints Needed

### Player-Facing
```
POST   /api/tournaments/[id]/register          # Self-register
POST   /api/tournaments/[id]/invite/accept     # Accept invite
POST   /api/tournaments/[id]/invite/decline    # Decline invite
POST   /api/tournaments/[id]/invite-request    # Request invite
POST   /api/tournaments/[id]/waitlist/join     # Join waitlist
DELETE /api/tournaments/[id]/waitlist/leave    # Leave waitlist
DELETE /api/tournaments/[id]/registration      # Cancel registration
GET    /api/player/dashboard                   # Dashboard data
GET    /api/player/tournaments                 # Player's tournaments
```

### Admin-Facing
```
POST   /api/admin/tournaments/[id]/invites            # Send invites
DELETE /api/admin/tournaments/[id]/invites/[inviteId] # Cancel invite
POST   /api/admin/tournaments/[id]/invites/[inviteId]/resend # Resend
GET    /api/admin/tournaments/[id]/registrations      # List registrations
DELETE /api/admin/tournaments/[id]/registrations/[regId] # Reject/remove
POST   /api/admin/tournaments/[id]/invite-requests/[requestId]/accept
POST   /api/admin/tournaments/[id]/invite-requests/[requestId]/decline
POST   /api/admin/tournaments/[id]/waitlist/[waitlistId]/register # Manual move
DELETE /api/admin/tournaments/[id]/waitlist/[waitlistId] # Remove from waitlist
```

---

## 8. Payment Integration (Stripe)

### Flow
```
1. Player clicks "Register" on paid tournament
2. Frontend creates Stripe Checkout Session:
   - Line item: Tournament registration
   - Metadata: { tournamentId, playerId, type: "registration" }
   - Success URL: /dashboard?registered=true
   - Cancel URL: /dashboard?registered=false
3. Player completes payment
4. Stripe webhook receives checkout.session.completed
5. Backend:
   - Creates TournamentRegistration (paymentStatus: PAID)
   - Sends confirmation email
   - Notifies admin
```

### Refund Flow
```
1. Player cancels or admin rejects
2. Backend calls Stripe Refund API
3. Updates TournamentRegistration (paymentStatus: REFUNDED)
4. Sends refund confirmation email
```

---

## 9. Implementation Phases

### Phase 1: Database & Core Logic
- [ ] Update Prisma schema with new models
- [ ] Run migration
- [ ] Create seed data for testing

### Phase 2: Tournament Setup
- [ ] Add "Registration Settings" tab to tournament editor
- [ ] Update save logic for new fields
- [ ] Admin can set restrictions

### Phase 3: Player Dashboard
- [ ] Create dashboard page
- [ ] Tournament card component with status logic
- [ ] Upcoming/Past tabs
- [ ] Filter and sort tournaments

### Phase 4: Registration Flows
- [ ] Self-registration (free)
- [ ] Self-registration (paid with Stripe)
- [ ] Cancel registration
- [ ] Refund handling

### Phase 5: Invite System
- [ ] Admin invite UI (select players)
- [ ] Admin invite UI (email invite)
- [ ] Invite expiry logic
- [ ] Accept/decline invite flows

### Phase 6: Invite Requests
- [ ] Player request invite UI
- [ ] Admin review UI
- [ ] Accept/decline logic

### Phase 7: Waitlist
- [ ] Join/leave waitlist
- [ ] Position calculation
- [ ] Auto-notification when spot opens
- [ ] 24h expiry logic

### Phase 8: Admin Management
- [ ] Admin panel with tabs
- [ ] Registered players table
- [ ] Pending invites table
- [ ] Invite requests table
- [ ] Waitlist table
- [ ] Reject registration with reason

### Phase 9: Emails
- [ ] Set up email service (Resend)
- [ ] Create all email templates
- [ ] Implement sending logic for each trigger

### Phase 10: Testing & Polish
- [ ] End-to-end testing of all flows
- [ ] Mobile responsiveness
- [ ] Error handling
- [ ] Loading states
- [ ] Success/confirmation animations

---

## 10. Open Questions / Future Enhancements

1. **Team Registrations**: Should teams register together, or individual players?
2. **Early Bird Pricing**: Discounts for early registration?
3. **Group Discounts**: Register 4+ players, get discount?
4. **Partial Refunds**: Tiered refund policy based on cancellation timing?
5. **Registration Forms**: Additional questions during registration (e.g., t-shirt size, dietary restrictions)?
6. **Check-in System**: Day-of tournament check-in?
7. **Notifications**: In-app notifications in addition to emails?
8. **Calendar Integration**: Auto-add to Google Calendar?

---

## Summary

This system provides a complete, modern tournament registration experience that:
- ✅ Minimizes friction for players
- ✅ Gives admins full control
- ✅ Handles payments securely
- ✅ Prevents duplicate registrations
- ✅ Manages waitlists automatically
- ✅ Communicates clearly via email
- ✅ Works beautifully on mobile

The architecture is extensible and ready for future enhancements like team registrations, advanced pricing tiers, and more sophisticated restriction logic.
