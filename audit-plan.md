# Ecommerce / Tournament App Improvement Plan

## Phase 1 – Risk & Revenue Protection

### 1. Lock down admin API routes
- **Goal:** ensure every route under src/app/api/admin/** requires a Clerk admin.
- **Implementation:**
  - Create src/lib/auth/adminGuard.ts that calls uth(), loads the player via Prisma, and throws 403 if !isAppAdmin.
  - Import that guard in every admin route (rosters, payments, teams) and call it at the top of each handler.
  - Add integration tests to confirm unauthorized access is blocked.

### 2. Automated payment reconciliation & monitoring
- **Goal:** automatically resolve stale PENDING payments and detect Stripe/DB mismatches.
- **Implementation:**
  - Add scripts/reconcile-payments.ts (cron-ready) that pulls Stripe payment intents and updates 	ournamentRegistration records, expiring ones older than 24h.
  - Emit structured logs / alerts when discrepancies are found.
  - Enhance /dashboard/payments to highlight pending > 24h and provide admin actions (resend link, cancel).

## Phase 2 – UX, Accessibility, Performance

### 1. Accessibility fixes in registration/checkout
- Add id/htmlFor pairs to inputs and labels (e.g., PlayerInfoStep).
- Ensure buttons have descriptive text and focus outlines; add aria-live regions for form errors.
- Run an axe/Lighthouse audit and fix any reported issues.

### 2. Pagination & caching for heavy dashboards
- Paginate 	ournamentRegistration queries (payments dashboard) via new API endpoints.
- Add Prisma indexes on paymentStatus/egisteredAt; consider caching stats with Redis/Vercel KV.
- Lazy-load dashboard widgets or fetch data client-side with SWR for large lists.

### 3. Pending payments UI improvements
- Keep the new Pending Payments table but add badges for days pending and admin action buttons.
- Surface payment intent IDs / manual payment indicators; show a banner if any payments need attention.

## Phase 3 – Architecture & Growth

### 1. Normalize payment/cart data model + tests/CI
- Move structured payment data into dedicated tables (RegistrationStop, RegistrationPaymentIntent, RegistrationAudit), removing reliance on 
otes JSON blobs.
- Update all payment/registration APIs to use the new schema with Prisma types.
- Introduce Jest/Playwright tests for pricing and registration->checkout flows, and run them in CI (GitHub Actions).

### 2. SEO metadata – homepage
- Implement generateMetadata for src/app/page.tsx with title, description, canonical URL, and OpenGraph/Twitter tags.
- Add JSON-LD (Organization) schema to the homepage and ensure the sitemap references it once the broader SEO work starts.
