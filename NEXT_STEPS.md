# Next Steps After Phase 2 Completion

**Current Status**: Phase 2 Complete ✅ (8/8 tasks, 100%)
**Date**: 2025-11-05

---

## 🎉 What You Have Now

### Complete Tournament Setup UI
- ✅ Flexible pricing models (tournament-wide, per-stop, per-bracket, combined)
- ✅ Per-stop pricing configuration with bulk actions
- ✅ Per-bracket pricing configuration grouped by game type
- ✅ Game type configuration grid (enable/disable per bracket)
- ✅ Capacity management (stop/bracket/club granularity)
- ✅ Stop registration settings (deadlines, manual close)
- ✅ 4 API endpoints for saving/loading all configurations
- ✅ Advanced Configuration tab integrated into tournament editor

### Database Schema (from Phase 1)
- ✅ All new tables created (StopPricing, BracketPricing, BracketGameTypeConfig, etc.)
- ✅ New ENUM types (PricingModel, GameType)
- ✅ Tournament table updated with new fields
- ✅ Stop table updated with registration deadline fields

---

## 🧪 Recommended: Testing Phase 2

Before moving to Phase 3, you should test the new UI:

### Test Checklist

#### 1. Tournament Creation
- [ ] Create a new paid tournament
- [ ] Select a pricing model (try each one):
  - [ ] Tournament-Wide (should NOT show Advanced Config tab)
  - [ ] Per-Stop (should show Advanced Config tab)
  - [ ] Per-Bracket (should show Advanced Config tab)
  - [ ] Per-Stop Per-Bracket (should show Advanced Config tab)
- [ ] Save the tournament

#### 2. Advanced Configuration Tab
- [ ] Open the Advanced Configuration tab (should appear after save)
- [ ] Verify data loads correctly
- [ ] Test Per-Stop Pricing:
  - [ ] Enter price for individual stop
  - [ ] Use "Set all stops to" bulk action
  - [ ] Verify total cost calculation
- [ ] Test Per-Bracket Pricing:
  - [ ] Enter price for individual bracket
  - [ ] Use "Set all brackets to" bulk action
  - [ ] Use "Set price by game type" quick action
  - [ ] Verify total cost calculation
- [ ] Test Game Type Configuration:
  - [ ] Enable/disable individual game types
  - [ ] Enter capacity for enabled cells
  - [ ] Use "Enable All" / "Disable All" bulk actions
  - [ ] Use "Apply capacity to all" bulk action
  - [ ] Verify summary counts
- [ ] Test Capacity Management:
  - [ ] Filter by stop, bracket, club
  - [ ] Enter capacity for individual combinations
  - [ ] Use "Set capacity for filtered rows" bulk action
  - [ ] Verify status indicators (% full, color coding)
  - [ ] Verify summary statistics
- [ ] Click "Save All Changes"
- [ ] Verify success message
- [ ] Reload page and verify data persists

#### 3. Edge Cases
- [ ] Create tournament with no stops (verify empty states)
- [ ] Create tournament with no brackets (verify empty states)
- [ ] Switch pricing model after configuration (verify data reloads)
- [ ] Test with very long tournament/stop/bracket names
- [ ] Test with many stops/brackets (20+)

#### 4. Error Handling
- [ ] Disconnect network and try to save (verify error message)
- [ ] Enter invalid capacity (verify validation)
- [ ] Enter invalid pricing (verify validation)

---

## 🚀 Phase 3: Player Registration UI (Recommended Next)

**Estimated Time**: 2.5 weeks (80-100 hours)
**Priority**: High (core functionality)

### Phase 3 Tasks

#### Task 1: Registration Page Layout (1 day)
- Create `/register/[tournamentId]` page
- Tournament header with name, dates, description
- Stepper component (4 steps: Info, Selection, Review, Payment)
- Progress indicator

#### Task 2: Player Information Form (2 days)
- Collect player details (name, email, phone)
- Account creation/login integration
- Validation (email format, required fields)
- Save form state to localStorage (prevent data loss)

#### Task 3: Stop Selection Component (2 days)
- Display all tournament stops with dates
- Multi-select checkboxes (for multi-stop tournaments)
- Show per-stop pricing (if applicable)
- Disable full stops (capacity reached)
- Running total calculator

#### Task 4: Bracket/Game Type Selection (3 days)
- Display available brackets per stop
- Show enabled game types per bracket
- Team tournaments: Select club + bracket → all 6 game types
- Individual tournaments: Select game types → select bracket per game type
- Disable full brackets (capacity reached)
- Show per-bracket pricing (if applicable)
- Running total calculator

#### Task 5: Registration Review (1 day)
- Summary of selected stops
- Summary of selected brackets/game types
- Total cost breakdown (itemized if per-stop/bracket)
- Edit buttons to go back to previous steps
- Confirm button

#### Task 6: Payment Integration (3 days)
- Stripe Checkout integration
- Create payment intent on server
- Redirect to Stripe Checkout
- Handle success/cancel redirects
- Store payment info in database

#### Task 7: Confirmation Page (1 day)
- Success message
- Registration details
- Next steps (roster placement, bracket generation)
- Email confirmation

#### Task 8: Validation & Error Handling (2 days)
- Capacity checking (race condition prevention)
- Payment verification
- Error states (payment failed, capacity full)
- Retry logic

**Total: ~15 days**

---

## 🔄 Phase 2.5: Background Jobs (Optional but Recommended)

**Estimated Time**: 1 week (32 hours)
**Priority**: Medium (can be done in parallel with Phase 3)

This phase sets up automated tasks:

### Tasks

1. **Cron Infrastructure** (1 day)
   - Set up Vercel Cron or similar
   - Create `/api/cron/registration-auto-close` endpoint
   - Create `/api/cron/waitlist-expiration` endpoint

2. **Stop Auto-Closure Service** (2 days)
   - Check for stops past registration deadline
   - Automatically close registration
   - Send notification to admins

3. **Waitlist Expiration Checker** (2 days)
   - Check for waitlist entries past 8-hour window
   - Automatically promote next person on waitlist
   - Send notification to next person

4. **Auto-Promotion Service** (2 days)
   - When spot opens, promote from waitlist
   - Create payment link for promoted player
   - Track promotion history

5. **Testing & Monitoring** (1 day)
   - Test cron jobs manually
   - Add logging and error tracking
   - Set up alerts for failures

**Total: ~8 days**

---

## 🏗️ Alternative: Phase 4 First (Stripe Payment)

If you want to validate payment flow before building full registration UI:

**Estimated Time**: 2 weeks (64 hours)

### Tasks

1. Set up Stripe account and API keys
2. Create payment intent API endpoint
3. Integrate Stripe Checkout
4. Handle webhooks (payment.succeeded, payment.failed)
5. Update TournamentRegistration status on payment
6. Refund handling
7. Testing with test cards

---

## 📝 Technical Debt to Address (Optional)

From Phase 2, these could be improved:

### Priority 1 (Quick Wins)
- [ ] Replace `alert()` with toast notifications (use existing toast system)
- [ ] Add confirmation dialog before "Reset Changes"
- [ ] Add loading skeleton states instead of spinner

### Priority 2 (Quality of Life)
- [ ] Extract shared types to `src/types/tournament.ts`
- [ ] Add auto-save (debounced) to AdvancedConfigTab
- [ ] Add optimistic updates for better UX

### Priority 3 (Nice to Have)
- [ ] Add configuration templates (save/load presets)
- [ ] Add export/import configuration as JSON
- [ ] Add audit log (who changed what when)

---

## 🎯 Recommended Path Forward

### Option A: Full Feature Development (Recommended)
1. ✅ **Phase 1**: Database Schema Updates (DONE)
2. ✅ **Phase 2**: Tournament Setup UI (DONE)
3. **Phase 3**: Player Registration UI (2.5 weeks)
4. **Phase 4**: Stripe Payment Integration (2 weeks)
5. **Phase 5**: Automatic Roster Placement (1 week)
6. **Phase 6**: Enhanced Admin UI (1.5 weeks)
7. **Phase 2.5**: Background Jobs (1 week)
8. **Phase 8**: Testing & QA (1.5 weeks)

**Total: ~10 weeks**

### Option B: MVP Path (Faster to Market)
1. ✅ **Phase 1**: Database Schema Updates (DONE)
2. ✅ **Phase 2**: Tournament Setup UI (DONE)
3. **Phase 3** (Simplified): Basic registration form (no stop/bracket selection) (1 week)
4. **Phase 4** (Simplified): Stripe integration (basic) (1 week)
5. **Manual roster placement** (admins do it manually)
6. **Phase 2.5**: Background jobs (critical only) (3 days)

**Total: ~4 weeks**, then iterate with remaining features

### Option C: Test & Polish Current Work
1. ✅ **Phase 1**: Database Schema Updates (DONE)
2. ✅ **Phase 2**: Tournament Setup UI (DONE)
3. **Testing Phase 2** (this document, section above) (2-3 days)
4. **Fix bugs found in testing** (1-2 days)
5. **Polish UI/UX** (1-2 days)
6. **Write documentation** (1 day)

**Total: ~1 week**, then continue to Phase 3

---

## 🐛 Known Issues to Watch For

From Phase 2 development:

1. **Prisma DB Pull Hanging**: Two background processes are still running. You may want to kill them:
   ```bash
   taskkill //PID 041952 //F
   taskkill //PID fec57c //F
   ```
   Or just restart your terminal.

2. **Type Conflicts**: `Stop` type is defined in both `PerStopPricingConfig` and `StopRegistrationSettings` with different fields. This is fine for now but could cause confusion.

3. **AdvancedConfigTab Data Loading**: Currently loads all data on mount. For tournaments with 100+ stops/brackets, this could be slow. Consider pagination if needed.

4. **Capacity `currentCount`**: Currently returned by API but not calculated anywhere. Need to implement roster count calculation (Phase 5).

---

## 💡 Quick Wins You Can Do Right Now

These are small improvements you can make immediately:

### 1. Replace alert() with Toast (5 minutes)
In `AdvancedConfigTab.tsx:173`, replace:
```typescript
alert('Configuration saved successfully!');
```
With:
```typescript
// Import your toast system at top
showSuccessToast('Configuration saved successfully!');
```

### 2. Add Loading Skeleton (15 minutes)
Replace the spinner in `AdvancedConfigTab.tsx:179-187` with skeleton loaders for better UX.

### 3. Update Prisma Schema (Optional, 5 minutes)
Run `npx prisma db pull` to sync your schema.prisma with the database changes from Phase 1. (Note: The migration already ran successfully in Supabase, this is just to update the local schema file.)

---

## 📞 Need Help?

If you encounter issues:

1. **Review Documentation**: Check `PHASE2_COMPLETE_SUMMARY.md` for implementation details
2. **Check API Responses**: Use browser DevTools Network tab to debug API calls
3. **Database Issues**: Query Supabase directly to verify data structure
4. **Type Errors**: All components export their types, check the export section

---

## 🎓 Key Files for Reference

### Components
- `src/app/tournaments/components/TournamentEditor.tsx` - Main editor with tabs
- `src/app/tournaments/components/tabs/RegistrationSettingsTab.tsx` - Basic registration settings
- `src/app/tournaments/components/tabs/AdvancedConfigTab.tsx` - Advanced configuration hub
- All new components in `src/app/tournaments/components/tabs/`

### API Routes
- `src/app/api/admin/tournaments/[tournamentId]/config/` - All new config endpoints

### Documentation
- `PHASE2_COMPLETE_SUMMARY.md` - Comprehensive Phase 2 summary
- `REGISTRATION_RULES_FINAL.md` - Complete business rules
- `SCHEMA_CHANGES.md` - Database schema documentation

---

**Last Updated**: 2025-11-05
**Status**: Ready for Phase 3 or Testing
**Recommended Next Action**: Test Phase 2 thoroughly, then proceed to Phase 3 (Player Registration UI)

