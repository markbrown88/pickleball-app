# Signup Flow Analysis & Improvement Plan

## Current State Analysis

### 1. Tournament Registration Flow
**Path:** `/register/[tournamentId]` → `POST /api/registrations`

**What happens:**
- User fills out registration form with: firstName, lastName, email, phone, gender
- If player doesn't exist (by email), creates new Player record with:
  - firstName, lastName, name (constructed), email, phone, gender
  - clubId (required for team tournaments, optional for individual)
  - clerkUserId (if logged in)
- If player exists, updates: firstName, lastName, name, phone, gender (if provided), email (if different), clerkUserId (if not linked)
- **Profile completion:** Data collected during registration is automatically saved to player profile

**Status:** ✅ **GOOD** - All required data collected upfront

---

### 2. Google SSO Signup Flow
**Path:** `/sign-up` → Clerk OAuth → Webhook `/api/webhooks/clerk` → Redirect to `/dashboard`

**What happens:**
1. User clicks "Sign up with Google"
2. Clerk handles OAuth, creates Clerk user account
3. Clerk sends `user.created` webhook to `/api/webhooks/clerk`
4. Webhook handler:
   - Checks if Player exists with that email (no clerkUserId)
   - If found: Links Clerk account to existing Player
   - If not found: Creates new Player with:
     - email (from Clerk)
     - firstName, lastName (from Clerk, if available)
     - name (constructed from firstName/lastName)
     - gender: 'MALE' (default)
     - country: 'Canada' (default)
     - clubId: First club alphabetically (required field)
5. User redirected to `/dashboard`
6. ProfileGuard checks if profile is complete (firstName, lastName, clubId)
7. If incomplete, redirects to `/profile`
8. User sees ProfileSetup form but can navigate away/cancel

**Data collected:** ✅ Email, firstName, lastName (if provided by Google)  
**Data missing:** ❌ Gender (defaults to MALE), Phone, City, Region, Birthday, Ratings  
**Problem:** User can skip profile completion and navigate away

**Status:** ⚠️ **NEEDS IMPROVEMENT** - Minimal data collected, easy to skip

---

### 3. Email/Password Signup Flow
**Path:** `/sign-up` → Clerk email/password → Webhook `/api/webhooks/clerk` → Redirect to `/dashboard`

**What happens:**
1. User enters email and password in Clerk signup form
2. Clerk creates user account (email only, no name required)
3. Clerk sends `user.created` webhook to `/api/webhooks/clerk`
4. Webhook handler creates Player with:
   - email (from Clerk)
   - firstName: null
   - lastName: null
   - name: null
   - gender: 'MALE' (default)
   - country: 'Canada' (default)
   - clubId: First club alphabetically
5. User redirected to `/dashboard`
6. ProfileGuard detects incomplete profile (no firstName/lastName)
7. Redirects to `/profile`
8. User sees ProfileSetup form but can navigate away/cancel

**Data collected:** ✅ Email only  
**Data missing:** ❌ Everything else (firstName, lastName, gender, phone, city, region, birthday, ratings)  
**Problem:** User can skip profile completion and navigate away

**Status:** ⚠️ **NEEDS IMPROVEMENT** - Only email collected, very easy to skip

---

## Current Problems

1. **Profile completion is optional** - Users can skip the ProfileSetup form
2. **No enforcement** - ProfileGuard redirects to `/profile` but user can navigate away
3. **Incomplete data** - Many players end up with minimal/default data
4. **Poor UX** - Users can get stuck or confused when redirected
5. **Multiple entry points** - Different flows create inconsistent experiences

---

## Recommended Solution: Mandatory Profile Setup After Signup

### Approach: Post-Signup Onboarding Flow

**Key Principles:**
1. **Immediate collection** - Collect all required data right after Clerk account creation
2. **Cannot skip** - Block access to app until profile is complete
3. **Progressive disclosure** - Show fields in logical groups
4. **Consistent experience** - Same flow for all signup methods

### Implementation Plan

#### Step 1: Create Dedicated Onboarding Route
- **New route:** `/onboarding` or `/complete-profile`
- **Purpose:** Mandatory profile completion page
- **Access:** Only accessible when profile is incomplete
- **Behavior:** Cannot navigate away until profile is saved

#### Step 2: Update Webhook Handler
- **Current:** Creates Player with minimal data
- **New:** Creates Player with `profileComplete: false` flag
- **Keep:** All current linking logic for existing players

#### Step 3: Update ProfileGuard
- **Current:** Redirects to `/profile` (can be skipped)
- **New:** Redirects to `/onboarding` (cannot be skipped)
- **Block:** All other routes until profile is complete

#### Step 4: Create Onboarding Component
- **Multi-step form** with progress indicator
- **Step 1:** Basic Info (firstName, lastName, gender, clubId) - **REQUIRED**
- **Step 2:** Contact Info (email, phone) - Email pre-filled, phone optional
- **Step 3:** Location (city, region, country) - All optional
- **Step 4:** Ratings & Birthday (DUPR Singles/Doubles, Club Ratings, Birthday) - All optional
- **Validation:** Cannot proceed to next step without required fields
- **Save:** Saves to database after each step (or all at once at end)

#### Step 5: Update Redirects
- **After Clerk signup:** Redirect to `/onboarding` instead of `/dashboard`
- **After onboarding:** Redirect to `/dashboard` or original destination
- **Tournament registration:** Keep current flow (already collects all data)

#### Step 6: Update Profile Completion Check
- **Add field:** `profileComplete: boolean` to Player model (or check required fields)
- **Required fields:** firstName, lastName, gender, clubId
- **Optional fields:** Everything else can be added later via profile page

---

## Alternative: Inline Onboarding Modal

Instead of a separate route, show a modal overlay that:
- Blocks all app functionality
- Cannot be dismissed until profile is complete
- Shows progress through steps
- Saves data incrementally

**Pros:** No route changes, feels more integrated  
**Cons:** Harder to implement, potential UX issues with navigation

---

## Recommended Fields

### Required (Cannot Skip)
- ✅ First Name
- ✅ Last Name  
- ✅ Gender
- ✅ Club

### Optional (Can Skip for Now)
- Email (pre-filled from Clerk)
- Phone
- City
- Region/Province/State
- Country (defaults to Canada)
- Birthday
- DUPR Singles
- DUPR Doubles
- Club Rating Singles
- Club Rating Doubles

---

## Next Steps

1. Review and approve this plan
2. Create `/onboarding` route and component
3. Update webhook handler to set `profileComplete: false`
4. Update ProfileGuard to enforce onboarding
5. Update redirects after Clerk signup
6. Test all three signup flows
7. Deploy and monitor

