# Tournament Registration System - Comprehensive Review

**Date**: 2025-11-05
**Reviewer**: Claude Code
**Status**: Requirements Confirmed - Ready for Implementation Planning

---

## Executive Summary

The current registration system has a **solid foundation (70% complete)** but requires **significant enhancements** to meet the full requirements:

### ✅ What Works Well
- Basic registration workflow (open/invite/waitlist)
- Tournament-wide pricing model
- Admin management dashboard
- Email notifications (partial)
- Proper database schema for expansion

### ❌ Critical Gaps Identified
1. **No multi-stop registration** - Players cannot select which stops to attend
2. **No bracket/game type selection** - Players cannot choose which brackets/game types they want to play
3. **No flexible pricing** - Missing per-stop and per-bracket pricing options
4. **No automatic roster placement** - Registered players don't get added to rosters
5. **No club selection** - Players cannot select which club they represent
6. **No stop-level pricing** - Cannot set different prices per stop
7. **No bracket-level pricing** - Cannot set different prices per game type
8. **No payment integration** - Stripe is not implemented
9. **No past-stop auto-closure** - Finished stops don't automatically close
10. **No partial registration tracking** - Cannot track which stops a player has already paid for

---

## Detailed Requirements (Confirmed)

### 1. Tournament Types & Pricing Models

#### A. Club/Team-Based Tournaments
- **Pricing**: Single fee covers ALL game types
- **Pricing Options**:
  - **Tournament-wide pricing**: One flat fee for entire tournament (all stops)
  - **Per-stop pricing**: Individual price per stop, pay as you register for each
- **Registration**: Player selects which club they represent
- **Flexibility**: Can play any/all game types within their selected brackets

#### B. Individual-Based Tournaments (Non-Team)
- **Pricing**: Per game type/bracket
  - Example: Singles = $50, Mixed Doubles = $60, Men's Doubles = $55
- **Pricing Options**:
  - **Tournament-wide pricing**: One price per bracket for all stops
  - **Per-stop pricing**: Different prices per stop AND per bracket
- **Registration**: No club selection needed
- **Flexibility**: Each game type has separate fee

### 2. Registration Selection Matrix

Players need maximum flexibility with quick-set convenience:

#### Multi-Stop Selection
- ✅ Checkbox for each available stop
- ✅ "Select All Stops" button
- ❌ **RULE**: Past stops (endAt < now) must be disabled/hidden
- ❌ **RULE**: Can only register for stops not already paid for

#### Multi-Bracket Selection (per Game Type)
- ✅ Can select **one bracket per game type** (e.g., 3.0, 3.5, 4.0, 4.5)
- ✅ Can select **multiple game types** (Singles, Doubles, Mixed)
- ✅ **Quick-set feature**: "Set all brackets to 3.5" button
- ✅ Example selections:
  - 3.0 Singles + 3.5 Men's Doubles + 4.0 Mixed Doubles ✓
  - 3.0 Singles + 3.0 Singles ✗ (duplicate game type)

#### Scenario-Based Registration

**Scenario A: Simple Tournament**
- 3 stops, club-based, tournament-wide pricing ($100)
- Player selects: Stop 1, Stop 2 → Pays $100 total

**Scenario B: Per-Stop Pricing**
- 3 stops, per-stop pricing (Stop 1=$50, Stop 2=$60, Stop 3=$40)
- Player selects: Stop 1, Stop 3 → Pays $90 ($50+$40)
- Later: Adds Stop 2 → Pays $60 more

**Scenario C: Individual Tournament with Per-Bracket Pricing**
- 2 stops, per-bracket pricing (Singles=$50, Doubles=$60)
- Player selects: Stop 1 only, Singles + Doubles → Pays $110
- Later: Adds Stop 2, Doubles only → Pays $60 more

**Scenario D: Maximum Complexity**
- 3 stops, per-stop AND per-bracket pricing
- Stop 1: Singles=$40, Doubles=$50
- Stop 2: Singles=$45, Doubles=$55
- Player selects: Stop 1 (Singles+Doubles) → Pays $90
- Later: Stop 2 (Doubles only) → Pays $55

### 3. Payment & Refund Rules

#### Payment Timing
- ✅ Payment happens **immediately** during registration
- ✅ Cannot complete registration without successful payment (unless free)
- ✅ For multi-stop per-stop pricing: Pay only for selected stops now

#### Refund Policy
- ✅ Can cancel/withdraw **up to 24 hours before** stop/tournament start
- ❌ **NO refunds** within 24 hours or after start
- ✅ Partial refunds: If registered for multiple stops and cancels some
- ❌ **Cannot change brackets** after registration (admin can manually change)

#### Re-Registration Prevention
- ✅ System tracks which stops already paid for
- ✅ UI must **disable/hide** already-registered stops
- ✅ Only show available stops for additional registration

### 4. Automatic Roster Placement

After successful registration + payment:

#### For Club/Team-Based Tournaments:
1. Create `TeamPlayer` record for selected club's team in each bracket
2. Create `StopTeamPlayer` record for each selected stop × bracket
3. Result: Player appears in roster for their club/team/bracket/stop

#### For Individual Tournaments:
1. Create tournament-level roster entry (TBD: may need new model)
2. Link to selected brackets and stops
3. Result: Player appears in bracket draw for selected game types

**Current Status**: ❌ **NOT IMPLEMENTED** - This is a critical gap

### 5. Registration Management UI

Admin should see comprehensive registration data:

#### Registration Tab Display (One Row Per Player)
| Player | Club | Game Types | Brackets | Stops | Payment Status | Date | Actions |
|--------|------|------------|----------|-------|----------------|------|---------|
| John Smith | Club A | Singles, Doubles | 3.5, 4.0 | 1, 2 | Paid ($150) | 11/01 | View/Reject |
| Jane Doe | Club B | Mixed | 3.0 | 1, 2, 3 | Paid ($200) | 11/02 | View/Reject |

**Current Status**: ⚠️ **PARTIAL** - Basic table exists but missing:
- Club column
- Game types column
- Brackets column
- Stops column
- Detailed payment breakdown

### 6. Club Selection (Team-Based Only)

When registering for club/team tournaments:
- ✅ Dropdown/select for available clubs
- ✅ Only clubs participating in the tournament
- ✅ Required field (cannot register without selecting club)
- ❌ Hidden for individual tournaments

**Current Status**: ❌ **NOT IMPLEMENTED**

---

## Database Schema Gaps

### Current Schema Review

#### ✅ Already Exists & Well-Designed:
- `Tournament` model with registration fields
- `TournamentRegistration` model
- `Stop` model with stop details
- `TournamentBracket` model
- `Team` model (club-based teams)
- `TeamPlayer` & `StopTeamPlayer` (roster models)
- Payment fields (paymentStatus, paymentId, amountPaid)

#### ❌ Missing Fields & Models:

### Required Schema Changes:

#### 1. Tournament Model - Add Pricing Type Fields
```prisma
model Tournament {
  // ... existing fields ...

  // NEW: Pricing configuration
  pricingModel          PricingModel         @default(TOURNAMENT_WIDE)  // TOURNAMENT_WIDE | PER_STOP | PER_BRACKET | PER_STOP_PER_BRACKET

  // Tournament-wide pricing (existing)
  registrationCost      Int?                 // in cents, null if free

  // NEW: Per-stop pricing
  stopPricing           StopPricing[]

  // NEW: Per-bracket pricing
  bracketPricing        BracketPricing[]
}

enum PricingModel {
  TOURNAMENT_WIDE        // One price for everything
  PER_STOP               // Price per stop (club tournaments)
  PER_BRACKET            // Price per bracket/game type (individual tournaments)
  PER_STOP_PER_BRACKET   // Price per stop AND bracket combination
}
```

#### 2. New Model: StopPricing
```prisma
model StopPricing {
  id           String     @id @default(cuid())
  tournamentId String
  stopId       String
  cost         Int        // in cents

  tournament   Tournament @relation(fields: [tournamentId], references: [id], onDelete: Cascade)
  stop         Stop       @relation(fields: [stopId], references: [id], onDelete: Cascade)

  @@unique([tournamentId, stopId])
  @@index([tournamentId])
}
```

#### 3. New Model: BracketPricing
```prisma
model BracketPricing {
  id           String            @id @default(cuid())
  tournamentId String
  bracketId    String
  stopId       String?           // null = tournament-wide, set = per-stop pricing
  cost         Int               // in cents

  tournament   Tournament        @relation(fields: [tournamentId], references: [id], onDelete: Cascade)
  bracket      TournamentBracket @relation(fields: [bracketId], references: [id], onDelete: Cascade)
  stop         Stop?             @relation(fields: [stopId], references: [id], onDelete: Cascade)

  @@unique([tournamentId, bracketId, stopId])
  @@index([tournamentId])
}
```

#### 4. TournamentRegistration Model - Add Selection Fields
```prisma
model TournamentRegistration {
  // ... existing fields ...

  // NEW: Selection tracking
  selectedClubId        String?              // null for individual tournaments
  selectedStopIds       String[]             // Array of stop IDs they registered for
  selectedBracketIds    String[]             // Array of bracket IDs they selected

  // NEW: Detailed payment tracking
  paymentBreakdown      Json?                // Detailed breakdown: [{stopId, bracketId, amount}, ...]
  totalAmountPaid       Int?                 // Total across all stops/brackets

  // Relations
  selectedClub          Club?                @relation(fields: [selectedClubId], references: [id])
}
```

#### 5. New Model: RegistrationStopPayment (Alternative: track individual stop payments)
```prisma
// This allows tracking each stop payment separately
model RegistrationStopPayment {
  id                    String                   @id @default(cuid())
  registrationId        String
  stopId                String
  bracketId             String?                  // null for club tournaments (pay for all brackets)

  amountPaid            Int                      // in cents
  paymentStatus         PaymentStatus            @default(PENDING)
  paymentId             String?                  // Stripe payment ID
  refundId              String?                  // Stripe refund ID
  paidAt                DateTime?
  refundedAt            DateTime?

  registration          TournamentRegistration   @relation(fields: [registrationId], references: [id], onDelete: Cascade)
  stop                  Stop                     @relation(fields: [stopId], references: [id], onDelete: Cascade)
  bracket               TournamentBracket?       @relation(fields: [bracketId], references: [id], onDelete: Cascade)

  @@unique([registrationId, stopId, bracketId])
  @@index([registrationId])
  @@index([stopId])
}
```

---

## Implementation Plan

### Phase 1: Database Schema Updates (1 week)
**Priority**: CRITICAL - Foundation for everything

#### Tasks:
1. ✅ Create migration for pricing model enums
2. ✅ Add `pricingModel` field to Tournament
3. ✅ Create `StopPricing` model and table
4. ✅ Create `BracketPricing` model and table
5. ✅ Create `RegistrationStopPayment` model and table
6. ✅ Update `TournamentRegistration` with selection fields
7. ✅ Add `selectedClub` relation
8. ✅ Test migrations on development database
9. ✅ Seed test data for different pricing scenarios

**Deliverables**:
- Updated `schema.prisma`
- Migration files
- Test data seeds

---

### Phase 2: Tournament Setup UI - Pricing Configuration (1.5 weeks)
**Priority**: CRITICAL - Admins need to configure pricing

#### Tasks:
1. ✅ Update `RegistrationSettingsTab.tsx` UI:
   - Add pricing model radio buttons (Tournament-wide / Per-Stop / Per-Bracket / Per-Stop-Per-Bracket)
   - Conditionally show pricing input based on selection
   - For Per-Stop: Show price input per stop
   - For Per-Bracket: Show price input per bracket
   - For Per-Stop-Per-Bracket: Show matrix of stop × bracket prices
2. ✅ Update `/api/admin/tournaments/{id}/config` endpoint:
   - Accept new pricing model and pricing data
   - Validate pricing configuration
   - Save to `StopPricing` / `BracketPricing` tables
3. ✅ Add stop-level auto-closure logic:
   - Background job or API check to mark stops as "closed" when `endAt < now`
   - Update tournament config API to respect stop closure
4. ✅ Update tournament validation:
   - Ensure pricing is complete for selected model
   - Validate that at least one stop is still open

**Deliverables**:
- Enhanced registration settings UI
- Updated config API with pricing support
- Stop auto-closure mechanism

---

### Phase 3: Player Registration UI - Selection Interface (2 weeks)
**Priority**: CRITICAL - Core player experience

#### Tasks:
1. ✅ Create new registration modal/page component:
   - Replace simple "Register" button with detailed form
   - Multi-stop selection (checkboxes, "Select All" button)
   - Multi-bracket selection (one per game type)
   - Quick-set bracket level (e.g., "Set all to 3.5")
   - Club selection dropdown (if team-based tournament)
   - Real-time price calculation display
   - Payment summary breakdown
2. ✅ Filter logic:
   - Hide/disable stops where `endAt < now`
   - Hide/disable stops already registered for
   - Show available brackets per game type
3. ✅ Validation:
   - At least one stop selected
   - At least one bracket selected
   - Club selected (if required)
   - Payment amount confirmed
4. ✅ Update `/api/player/tournaments/{id}/register` endpoint:
   - Accept `selectedStopIds[]`, `selectedBracketIds[]`, `selectedClubId`
   - Calculate total cost based on pricing model
   - Create `TournamentRegistration` record
   - Create `RegistrationStopPayment` records (one per stop/bracket combo)
   - Return payment intent/checkout URL (Stripe)
5. ✅ Handle partial registration state:
   - If payment pending, don't create roster entries yet
   - Store selection data for completion after payment

**Deliverables**:
- Registration form component with full selection UI
- Updated registration API with pricing calculation
- Payment integration placeholder (Stripe)

---

### Phase 4: Payment Integration - Stripe (2 weeks)
**Priority**: HIGH - Required for paid tournaments

#### Tasks:
1. ✅ Set up Stripe account and API keys
2. ✅ Create Stripe checkout session:
   - Generate line items based on selected stops/brackets
   - Create checkout session with success/cancel URLs
3. ✅ Implement payment webhook:
   - Handle `checkout.session.completed` event
   - Update `paymentStatus` to PAID
   - Update `amountPaid` and `paymentId`
   - Trigger roster placement (see Phase 5)
4. ✅ Implement refund processing:
   - Check 24-hour rule before refund
   - Create Stripe refund for appropriate amount
   - Update `paymentStatus` to REFUNDED
   - Update `refundId`
   - Remove roster entries
5. ✅ Add payment status tracking UI:
   - Show payment pending state
   - Show payment confirmation
   - Show refund status
6. ✅ Handle failed payments:
   - Mark registration as FAILED
   - Allow retry
   - Clean up orphaned records

**Deliverables**:
- Stripe integration module
- Payment webhook handler
- Refund processing logic
- Payment status UI

---

### Phase 5: Automatic Roster Placement (1.5 weeks)
**Priority**: CRITICAL - Core functionality gap

#### Tasks:
1. ✅ Create roster placement service:
   - Input: Completed registration + payment
   - Logic for club/team-based tournaments:
     - Find team for `selectedClubId` × each `selectedBracketId`
     - Create `TeamPlayer` record (if not exists)
     - For each `selectedStopId`: Create `StopTeamPlayer` record
   - Logic for individual tournaments:
     - Create bracket assignment records (may need new model)
     - Link to selected brackets and stops
2. ✅ Integrate with payment webhook:
   - Call roster placement service on successful payment
3. ✅ Integrate with admin manual registration:
   - Call roster placement service when admin registers player
4. ✅ Add removal logic:
   - On withdrawal/rejection: Remove `TeamPlayer` and `StopTeamPlayer` records
   - Handle cases where player is in lineups (should prevent removal or cascade)
5. ✅ Add safety checks:
   - Prevent duplicate roster entries
   - Validate team exists before placement
   - Handle team capacity limits (if applicable)

**Deliverables**:
- Roster placement service module
- Integration with payment flow
- Integration with admin actions
- Comprehensive error handling

---

### Phase 6: Registration Management UI - Enhanced Display (1 week)
**Priority**: MEDIUM - Admin visibility

#### Tasks:
1. ✅ Update `RegistrationsTab.tsx`:
   - Add "Club" column (show selected club name)
   - Add "Game Types" column (show selected bracket names)
   - Add "Brackets" column (show bracket levels: 3.0, 3.5, etc.)
   - Add "Stops" column (show stop names/dates)
   - Update "Payment Status" column (show breakdown on hover/expand)
2. ✅ Add filter/search functionality:
   - Filter by club
   - Filter by bracket
   - Filter by stop
   - Filter by payment status
3. ✅ Add export functionality:
   - Export to CSV/Excel
   - Include all registration details
4. ✅ Add bulk actions:
   - Bulk reject
   - Bulk approve (for invite requests)
   - Bulk roster placement (if needed)

**Deliverables**:
- Enhanced registration table UI
- Filter and search features
- Export functionality

---

### Phase 7: Additional Registration Features (1 week)
**Priority**: LOW - Nice to have

#### Tasks:
1. ✅ Add "My Registrations" page for players:
   - Show all current registrations
   - Show stop details and brackets
   - Show payment history
   - Allow withdrawal (if within 24h)
   - Allow adding additional stops
2. ✅ Add registration email improvements:
   - Include stop details in confirmation email
   - Include bracket details
   - Include payment breakdown
   - Include calendar invite (.ics file)
3. ✅ Add registration analytics:
   - Total revenue by stop
   - Total revenue by bracket
   - Registration trends over time
   - Popular bracket/stop combinations

**Deliverables**:
- Player registration management page
- Enhanced email templates
- Analytics dashboard

---

### Phase 8: Testing & QA (1 week)
**Priority**: CRITICAL - Ensure quality

#### Tasks:
1. ✅ Unit tests:
   - Pricing calculation logic
   - Roster placement service
   - Refund eligibility checks
2. ✅ Integration tests:
   - Full registration flow (free tournament)
   - Full registration flow (paid tournament)
   - Multi-stop registration
   - Multi-bracket registration
   - Partial registration (add stops later)
   - Withdrawal and refund
3. ✅ End-to-end tests:
   - Complete player journey
   - Complete admin journey
   - Payment webhook handling
4. ✅ Edge case testing:
   - Expired stop registration attempts
   - Duplicate registration attempts
   - Payment failures
   - Refund edge cases (24h boundary)
   - Concurrent registrations (race conditions)
5. ✅ Load testing:
   - Multiple simultaneous registrations
   - Large tournament scenarios

**Deliverables**:
- Test suite with high coverage
- Bug fixes
- Performance optimizations

---

## Timeline Summary

| Phase | Duration | Priority | Status |
|-------|----------|----------|--------|
| Phase 1: Database Schema | 1 week | CRITICAL | Not Started |
| Phase 2: Tournament Setup UI | 1.5 weeks | CRITICAL | Not Started |
| Phase 3: Player Registration UI | 2 weeks | CRITICAL | Not Started |
| Phase 4: Payment Integration | 2 weeks | HIGH | Not Started |
| Phase 5: Automatic Roster Placement | 1.5 weeks | CRITICAL | Not Started |
| Phase 6: Registration Management UI | 1 week | MEDIUM | Not Started |
| Phase 7: Additional Features | 1 week | LOW | Not Started |
| Phase 8: Testing & QA | 1 week | CRITICAL | Not Started |
| **TOTAL** | **11 weeks** | | |

**Recommended Approach**: Phases 1-5 are critical path and should be prioritized. Phases 6-7 can be done in parallel or deferred.

---

## Risk Assessment

### High Risk Items:
1. **Payment Integration Complexity**: Stripe integration with webhooks, refunds, and edge cases is complex
   - *Mitigation*: Extensive testing, use Stripe test mode, implement comprehensive error handling
2. **Roster Placement Logic**: Multiple tournament types and configurations increase complexity
   - *Mitigation*: Create clear service abstraction, comprehensive unit tests
3. **Data Migration**: Existing tournaments need backward compatibility
   - *Mitigation*: Default to TOURNAMENT_WIDE pricing for existing tournaments, add migration script

### Medium Risk Items:
1. **UI Complexity**: Registration form can get overwhelming with all options
   - *Mitigation*: Progressive disclosure, clear UX design, user testing
2. **Race Conditions**: Concurrent registrations could cause issues
   - *Mitigation*: Database constraints, optimistic locking, transaction handling

### Low Risk Items:
1. **Email Notifications**: Already partially working
2. **Admin UI Updates**: Straightforward enhancements

---

## Questions & Answers - RESOLVED

### 1. **Individual Tournament Roster** ✅
**Q**: For non-team tournaments, where should players be placed after registration?
**A**: Keep them in the Registration tab for now. Individual tournaments don't have fully built-out brackets yet. Eventually, Tournament Admins will build elimination brackets using these registered players.
**Implementation**: No immediate roster placement for individual tournaments - Phase 5 only applies to team-based tournaments.

### 2. **Player Capacity Limits** ✅
**Q**: Should there be limits on how many players can register for a specific club/team/bracket combination?
**A**: YES - Limits should be per **stop/club/bracket** combination. For individual tournaments, limits are per stop or whole tournament.
**Current Status**: Only tournament-level `maxPlayers` exists. Need to add per-stop-bracket capacity limits.
**Implementation**: Add capacity fields to appropriate models (see updated schema below).

### 3. **Waitlist with Multi-Stop** ✅
**Q**: How does waitlist work with multi-stop and bracket selections?
**A**: Waitlist is per **stop/club/bracket**. When a spot opens:
- Player gets email notification
- They have **8 hours** (not 24) to register and pay
- If they don't register in time, next person on waitlist gets notification
- If first person returns late, they see "slot expired" message
- They can rejoin waitlist if registration still open

**Current Status**: Waitlist is tournament-level only with 24-hour window. Need complete redesign.
**Implementation**: Major changes required - new waitlist model, timer system, email notifications.

### 4. **Admin Bracket Changes** ✅
**Q**: Should there be UI for admins to manually change player brackets?
**A**: YES - Ideally on the Roster page, admins can **drag/drop** players from one bracket to another.
**Implementation**: Add drag-drop functionality to Roster management UI (Phase 6).

### 5. **Registration Deadline** ✅
**Q**: Per-stop or tournament-wide registration deadline?
**A**: **Per-stop** - Each stop has its own registration deadline.
**Current Status**: Tournament has `registrationDeadline` field. Stops don't have individual deadlines.
**Implementation**: Add `registrationDeadline` field to Stop model.

### 6. **Payment Processing Time** ✅
**Q**: What should happen during payment processing window?
**A**: Payment must be **immediate** during registration. Stripe checkout happens as part of registration flow. No "pending payment" state for players - either they complete payment or registration fails.
**Implementation**: Registration → Stripe Checkout → Webhook confirms → Roster placement (all in one flow).

### 7. **Refund Policy** ✅
**Q**: How are refunds calculated for partial withdrawals?
**A**: **No partial refunds**. Refund policy is simple:
- More than 24 hours before tournament starts: **Full refund**
- Within 24 hours or after start: **No refund**
**Implementation**: Single refund calculation - no pro-rata logic needed.

---

## Conclusion

This is a **significant but achievable enhancement** to the registration system. The existing foundation is solid, but the new requirements represent approximately **11 weeks of development effort** across database, API, UI, and payment integration work.

The system will be **production-ready** after completion of Phases 1-5 and 8 (core functionality + testing), which represents approximately **8-9 weeks** of critical path work.

**Recommendation**: Proceed with phased implementation, starting with database schema updates and pricing configuration, then moving through the player registration flow and payment integration.
