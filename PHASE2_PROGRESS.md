# Phase 2 Progress - Tournament Setup UI

**Started**: 2025-11-05
**Status**: In Progress (Task 1 Complete)

---

## ✅ Task 1 Complete: Pricing Model Selection UI

**Duration**: ~30 minutes
**File Modified**: `src/app/tournaments/components/tabs/RegistrationSettingsTab.tsx`

### What Was Added

1. **New Type**: `PricingModel` with 4 options
   ```typescript
   type PricingModel = 'TOURNAMENT_WIDE' | 'PER_STOP' | 'PER_BRACKET' | 'PER_STOP_PER_BRACKET';
   ```

2. **Updated Type**: Added `pricingModel` field to `EditorRowWithRegistration`

3. **New UI Section**: "Pricing Model" with 4 radio button options
   - Tournament-Wide Pricing (default/simplest)
   - Per-Stop Pricing (for multi-stop tournaments)
   - Per-Bracket Pricing (for individual tournaments)
   - Per-Stop Per-Bracket Pricing (maximum flexibility)

4. **Conditional Display**:
   - Only shows when `registrationType === 'PAID'`
   - Shows helpful note when advanced pricing is selected
   - Includes clear descriptions for each option

5. **Summary Integration**: Pricing model now displayed in summary section

### Screenshots/Preview

The new section appears between "Registration Type" and "Player Limit" sections and includes:
- Clear radio button options
- Descriptive text for each pricing model
- Informational note about advanced configuration
- Integration with existing UI patterns

### Code Changes Summary

- **Lines added**: ~90
- **New types**: 1 (PricingModel)
- **New UI sections**: 1 (Pricing Model)
- **Modified sections**: 1 (Summary)

---

## 🎯 Next Steps

### Task 2: Create Per-Stop Pricing Component (4 hours)

**Goal**: Build component to configure pricing for each stop individually

**File to Create**: `src/app/tournaments/components/tabs/PerStopPricingConfig.tsx`

**Requirements**:
- Display list of all tournament stops
- Input field for each stop's price
- "Set all to same price" quick action
- Validation (positive numbers only)
- Save functionality

**Depends On**:
- Tournament must have stops defined
- Tournament must have pricingModel === 'PER_STOP' or 'PER_STOP_PER_BRACKET'

### Task 3: Create Per-Bracket Pricing Component (4 hours)

**File to Create**: `src/app/tournaments/components/tabs/PerBracketPricingConfig.tsx`

**Requirements**:
- Display list of all tournament brackets
- Input field for each bracket's price
- Quick actions for same game type pricing
- Validation
- Save functionality

---

## 📊 Phase 2 Progress Tracker

| Task | Status | Duration | Completion |
|------|--------|----------|------------|
| 1. Pricing Model Selection | ✅ Complete | 0.5 hours | 100% |
| 2. Per-Stop Pricing Component | ⏳ Next | 4 hours | 0% |
| 3. Per-Bracket Pricing Component | 📋 Pending | 4 hours | 0% |
| 4. Game Type Configuration Grid | 📋 Pending | 6 hours | 0% |
| 5. Capacity Management Component | 📋 Pending | 6 hours | 0% |
| 6. Update API Endpoints | 📋 Pending | 6 hours | 0% |
| 7. Tournament Editor Integration | 📋 Pending | 4 hours | 0% |
| 8. Per-Stop Settings | 📋 Pending | 3 hours | 0% |
| **Testing & Bug Fixes** | 📋 Pending | 8 hours | 0% |
| **Total** | | **41.5 hours** | **1.2%** |

**Estimated Completion**: 7.5 days remaining

---

## 🎉 Milestone: First UI Enhancement Complete!

The pricing model selection is now live and ready to use. Tournament admins can now choose between 4 different pricing models when creating tournaments.

**What Works**:
- ✅ Radio button selection
- ✅ Conditional display (only for paid tournaments)
- ✅ Clear descriptions
- ✅ Summary integration
- ✅ Type-safe implementation

**What's Next**:
Once Task 2 is complete, admins will be able to set different prices for each stop in multi-stop tournaments!

---

## 💡 Notes & Observations

### Good Patterns to Continue
- Clear descriptive text for each option
- Conditional display based on context
- Integration with existing summary section
- Consistent styling with rest of component

### Considerations for Next Tasks
1. **Data Loading**: Tasks 2-8 will need to load additional data (stops, brackets, existing config)
2. **Save Strategy**: Need to decide when to save (immediate vs. on tournament save)
3. **Validation**: Each component needs input validation
4. **UX**: Loading states, error handling, success messages

### Questions for Later
- Should pricing config be saved immediately or with tournament?
- How to handle changing pricing model after registrations exist?
- Should we show warnings when making breaking changes?

---

*Last Updated: 2025-11-05*
*Progress: 1 of 8 tasks complete*
*Next Task: Per-Stop Pricing Component*
