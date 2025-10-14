# Date Formatting Standardization

## Overview

This document outlines the standardized date formatting implemented across the application to ensure consistency.

## Standard Format Rules

### Single Dates
**Format:** `Aug 23, 2025`
- Month: Short 3-letter abbreviation (Jan, Feb, Mar, etc.)
- Day: Numeric without leading zero
- Year: Full 4-digit year

### Date Ranges
**Same Year:** `Aug 23 – Aug 24, 2025`
- Show year only at the end
- Use en dash (–) between dates

**Different Years:** `Dec 23, 2025 – Jan 23, 2026`
- Show year after each date

**Same Day:** `Aug 23, 2025`
- Display as single date (no range)

## Utility Functions

All date formatting is centralized in [src/lib/utils.ts](../src/lib/utils.ts):

### `formatDateUTC(dateString: string | null | undefined): string`
Formats a single date string using UTC timezone.

**Usage:**
```typescript
import { formatDateUTC } from '@/lib/utils';

const formatted = formatDateUTC('2025-08-23');
// Returns: "Aug 23, 2025"
```

### `formatDateRangeUTC(start?: string | null, end?: string | null): string`
Formats a date range with intelligent year placement.

**Usage:**
```typescript
import { formatDateRangeUTC } from '@/lib/utils';

// Same year
const range1 = formatDateRangeUTC('2025-08-23', '2025-08-24');
// Returns: "Aug 23 – Aug 24, 2025"

// Different years
const range2 = formatDateRangeUTC('2025-12-23', '2026-01-23');
// Returns: "Dec 23, 2025 – Jan 23, 2026"

// Same day
const range3 = formatDateRangeUTC('2025-08-23', '2025-08-23');
// Returns: "Aug 23, 2025"
```

## Files Updated

### ✅ Already Using Standard Format
- [src/app/results/page.tsx](../src/app/results/page.tsx) - Using `formatDateRangeUTC`
- [src/app/rosters/page.tsx](../src/app/rosters/page.tsx) - Using both utilities
- [src/app/manager/components/EventManagerTab.tsx](../src/app/manager/components/EventManagerTab.tsx) - Using both utilities

### ✅ Fixed in This Update
1. **[src/app/(player)/dashboard/helpers.ts](../src/app/(player)/dashboard/helpers.ts)** (Line 8-16)
   - Fixed `nextStopLabel` function to handle Date objects
   - Converts Date to ISO string before formatting

2. **[src/app/tournaments/page.tsx](../src/app/tournaments/page.tsx)** (Line 58-60)
   - Replaced custom `between` function with `formatDateRangeUTC`
   - Removed redundant logic

3. **[src/app/captain/[token]/page.tsx](../src/app/captain/[token]/page.tsx)** (Line 180-184)
   - Replaced `toLocaleDateString` with `formatDateUTC`
   - Ensures consistent format

4. **[src/app/captain/[token]/stop/[stopId]/page.tsx](../src/app/captain/[token]/stop/[stopId]/page.tsx)** (Line 98-100)
   - Replaced `toLocaleDateString` with `formatDateUTC`
   - Simplified date handling

5. **[src/app/(player)/dashboard/page.tsx](../src/app/(player)/dashboard/page.tsx)** (Lines 242, 276)
   - Replaced `toLocaleDateString` with `formatDateUTC`
   - Added Date to string conversion for compatibility

### ⚠️ Needs Attention (Not Critical)
These files have date formatting that may need review but are less critical:

1. **[src/app/(player)/profile/ProfileForm.tsx](../src/app/(player)/profile/ProfileForm.tsx)**
   - Lines 221-223: Age calculation (legitimate use of getFullYear/getMonth/getDate)
   - Line 700: Tournament date display using `toLocaleDateString`
   - Line 762: Game date display using `toLocaleDateString`
   - **Recommendation:** Update tournament and game date displays to use `formatDateUTC`

2. **[src/app/(player)/shared/useProfileData.ts](../src/app/(player)/shared/useProfileData.ts)**
   - Lines 115-118: Default date calculation (legitimate use)
   - This is for form defaults and doesn't need updating

3. **[src/app/app-admin/page.tsx](../src/app/app-admin/page.tsx)**
   - Lines 342, 345: Shows start/end dates in separate table columns
   - **Recommendation:** This is fine for table layout; could optionally combine into one column using `formatDateRangeUTC`

### ℹ️ Special Cases

**Main Homepage** ([src/app/page.tsx](../src/app/page.tsx))
- No direct date formatting found; likely loads tournament data that uses standard utilities

## Implementation Guidelines

### For New Code

1. **Always import the utilities:**
   ```typescript
   import { formatDateUTC, formatDateRangeUTC } from '@/lib/utils';
   ```

2. **For single dates:**
   ```typescript
   {formatDateUTC(dateString)}
   ```

3. **For date ranges:**
   ```typescript
   {formatDateRangeUTC(startDate, endDate)}
   ```

4. **Handling Date objects:**
   If you have a Date object instead of a string:
   ```typescript
   const dateString = dateObj instanceof Date ? dateObj.toISOString() : dateObj;
   {formatDateUTC(dateString)}
   ```

### What NOT to Do

❌ **Don't use:**
- `toLocaleDateString()` - Uses browser locale, inconsistent formatting
- `toDateString()` - Different format than our standard
- Manual date formatting with `getMonth()`, `getDate()`, `getFullYear()`
- Custom date formatting logic

✅ **Do use:**
- `formatDateUTC()` for single dates
- `formatDateRangeUTC()` for date ranges
- Centralized utility functions

## Benefits of Standardization

1. **Consistency** - All dates displayed in the same format throughout the app
2. **Maintainability** - Single source of truth for date formatting logic
3. **Timezone Handling** - UTC-based formatting prevents timezone issues
4. **Internationalization Ready** - Easy to update format in one place if needed
5. **Intelligent Ranges** - Automatic handling of year placement in ranges

## Testing

To verify date formatting:

1. **Same year range:**
   - Input: Aug 23 - Aug 24, 2025
   - Expected: "Aug 23 – Aug 24, 2025"

2. **Different year range:**
   - Input: Dec 23, 2025 - Jan 23, 2026
   - Expected: "Dec 23, 2025 – Jan 23, 2026"

3. **Single date/same day:**
   - Input: Aug 23, 2025 - Aug 23, 2025
   - Expected: "Aug 23, 2025"

4. **Null handling:**
   - Input: null or undefined
   - Expected: "—"

## Migration Checklist

- [x] Review existing date formatting utility functions
- [x] Find all instances of date formatting in the codebase
- [x] Update tournaments page
- [x] Update captain portal pages
- [x] Update player dashboard
- [x] Update dashboard helpers
- [ ] Optional: Update profile form displays (non-critical)
- [ ] Optional: Combine admin table columns (enhancement)
- [x] Document the standard format
- [x] Create migration guide

## Future Enhancements

Consider these improvements:

1. **Relative Dates:** "Today", "Tomorrow", "2 days ago"
2. **Time Display:** Standardize time formatting if needed
3. **Date Pickers:** Ensure form inputs use consistent format
4. **Localization:** Easy to add i18n support with central utilities

## Related Files

- **Utility Functions:** [src/lib/utils.ts](../src/lib/utils.ts)
- **Type Definitions:** [src/types/index.ts](../src/types/index.ts)
- **Production Fixes:** [PRODUCTION_FIXES.md](./PRODUCTION_FIXES.md)
