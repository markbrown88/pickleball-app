## DUPR API Integration Notes (research + assumptions)

> Swagger UI: https://backend.mydupr.com/swagger-ui/index.html  
> Status: Not authenticated in this environment; details below are based on common Swagger patterns for DUPR. Validate in Swagger before wiring code.

### 1) Auth & Base URL
- Base URL (observed): `https://backend.mydupr.com` (may also expose `https://api.mydupr.com`).
- Auth: Swagger typically shows an `Authorize` button. Expect one of:
  - `Authorization: Bearer <token>` (JWT/session token issued via login) **or**
  - `x-api-key: <key>` (API key header).
- Required headers (verify in Swagger):
  - `Authorization` or `x-api-key`
  - `Content-Type: application/json`
- Rate limits: not documented in search; assume sane limits. Add client-side backoff and caching.

### 2) Likely useful endpoints (confirm names/paths in Swagger)
- **Search players**: `GET /players/search?query=<text>` (or similar) to find by email/name. Inspect params: `email`, `name`, or generic `query`.
- **Get player by ID**: `GET /players/{id}` returning profile/ratings.
- **Possible ratings fields** (confirm): `singlesRating`, `doublesRating`, maybe `utr`/`dupr` naming variants. Look for timestamps like `ratingUpdatedAt`.

### 3) Data mapping to our schema
- Our fields: `duprSingles`, `duprDoubles` (Player model).
- Normalize incoming DUPR response to:
  - `duprSingles = singlesRating ?? null`
  - `duprDoubles = doublesRating ?? null`
  - `ratingUpdatedAt` (if present) for freshness checks.
- If only one rating is returned, map it to both or prefer doubles as default; document this choice.

### 4) Service shape (for later coding)
```ts
type DuprLookupInput =
  | { email: string }
  | { duprPlayerId: string }
  | { name: { first?: string; last?: string } };

type DuprRating = {
  duprSingles: number | null;
  duprDoubles: number | null;
  duprPlayerId?: string;
  ratingUpdatedAt?: string;
  source: 'dupr';
};

async function fetchDuprRatings(input: DuprLookupInput): Promise<DuprRating | null> {
  // 1) Build query (prefer email, then ID, then name search)
  // 2) Call DUPR search/get endpoint with auth header
  // 3) If multiple matches, pick exact email match; else highest confidence
  // 4) Normalize fields to DuprRating
}
```
- Error handling: distinguish `401/403` (bad/expired token), `404/empty` (no match), `429` (rate limit), network errors.
- Caching: cache successful lookups for 6–24h to reduce calls; short-cache misses for 15–60m.

### 5) Sync triggers (pick one or combine)
- Manual admin action: e.g., `POST /api/internal/dupr-sync?playerId=...` (admin-only).
- Profile view warmup: optionally fetch if cached value is stale.
- Scheduled job: nightly refresh for players with known DUPR IDs/emails.

### 6) Security & config
- Env vars (examples; confirm once auth type is known):
  - `DUPR_BASE_URL=https://backend.mydupr.com`
  - `DUPR_API_KEY=<if api-key auth>`
  - `DUPR_BEARER_TOKEN=<if bearer auth>` (rotate/refresh as needed)
  - `DUPR_CACHE_TTL_HOURS=24` (optional)
- Never log tokens/headers. Redact auth headers in error logs.

### 7) Validation checklist (do in Swagger before coding)
1. Click **Authorize**: note the auth scheme (API key name vs Bearer).
2. Find **player search** endpoint: confirm path, params (email/name/id), and response shape.
3. Find **get player by ID**: confirm ratings fields and field names for singles/doubles.
4. Confirm any paging/rate-limit headers.
5. Test a sample request in Swagger to capture exact JSON for typings.


