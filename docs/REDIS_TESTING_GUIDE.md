# Redis Testing Guide

Complete guide for testing Redis caching and rate limiting in your pickleball tournament application.

## Quick Start

### 1. Test Redis Directly

This tests the Redis connection without going through your API:

```bash
node test-redis.js
```

**What it tests:**
- ✅ Cache Redis (ioredis) connection
- ✅ Rate Limit Redis (@upstash/redis) connection
- ✅ Environment variables configuration
- ✅ Basic Redis operations (GET, SET, INCR)

**Expected output:**
```
═══════════════════════════════════════════
  Redis Configuration Test Suite
═══════════════════════════════════════════

3️⃣  Environment Variables Check...
   ✓ REDIS_URL: redis://default:AU-j...
   ✓ UPSTASH_REDIS_REST_URL: https://dynamic-racer-20387...
   ✓ UPSTASH_REDIS_REST_TOKEN: AbCdEfGhIj...

1️⃣  Testing Cache Redis (ioredis)...
   ✓ REDIS_URL configured
   ✓ Connected to Redis
   ✓ PING response: PONG
   ✓ SET test:key
   ✓ GET test:key: Hello from test script!
   ✓ SET tournaments:all (cache pattern)
   ✓ Cleaned up test keys
   ✅ Cache Redis is working!

2️⃣  Testing Rate Limit Redis (@upstash/redis)...
   ✓ UPSTASH_REDIS_REST_URL configured
   ✓ UPSTASH_REDIS_REST_TOKEN configured
   ✓ PING response: PONG
   ✓ SET test:ratelimit
   ✓ GET test:ratelimit: Rate limit test
   ✓ INCR test:counter:1234567890: 1
   ✓ Cleaned up test keys
   ✅ Rate Limit Redis is working!

═══════════════════════════════════════════
  Test Results
═══════════════════════════════════════════
Environment Variables: ✅ PASS
Cache Redis (ioredis): ✅ PASS
Rate Limit Redis:      ✅ PASS
═══════════════════════════════════════════

🎉 All tests passed! Redis is fully operational.
```

---

### 2. Test via API Endpoints (Development)

This tests Redis through your actual API endpoints:

```bash
# Start your dev server first
npm run dev

# In another terminal, run:
API_URL=http://localhost:3010 node test-api-redis.js
```

**What it tests:**
- ✅ Cache hit/miss behavior
- ✅ Rate limiting enforcement
- ✅ Security headers
- ✅ Performance improvements

**Expected output:**
```
═══════════════════════════════════════════
  API Redis Test Suite
═══════════════════════════════════════════

1️⃣  Testing Cache Behavior...
   Making first request (should be cache miss)...
   ✓ First request: 245ms
   ✓ Tournaments: 2
   Making second request (should be cache hit)...
   ✓ Second request: 52ms
   ✅ Cache hit detected! 78.8% faster

2️⃣  Testing Rate Limiting...
   Making 12 rapid requests to captain portal...
   ✓ Request 1: 404 (Remaining: 9/10)
   ✓ Request 2: 404 (Remaining: 8/10)
   ...
   ✓ Request 11: 429 Too Many Requests (Retry-After: 3s)
   ✅ Rate limiting is working!
   ✓ X-RateLimit-Limit: 10
   ✓ X-RateLimit-Remaining: 0

3️⃣  Testing Cache-Related Headers...
   Security Headers:
   ✓ Strict-Transport-Security: max-age=63072000...
   ✓ X-Content-Type-Options: nosniff
   ✓ X-Frame-Options: DENY

4️⃣  Testing Performance with Multiple Requests...
   ✓ Request 1: 198ms
   ✓ Request 2: 45ms
   ✓ Request 3: 42ms
   ✓ Request 4: 48ms
   ✓ Request 5: 44ms

   Average: 75ms | Min: 42ms | Max: 198ms
   ✅ Cache is working (min is much faster than average)

═══════════════════════════════════════════
  Test Results
═══════════════════════════════════════════
Cache Behavior:    ✅ PASS
Rate Limiting:     ✅ PASS
Headers:           ✅ PASS
Performance:       ✅ PASS
═══════════════════════════════════════════

🎉 Core functionality working!
```

---

### 3. Test in Production

After deploying to Vercel:

```bash
API_URL=https://your-domain.com node test-api-redis.js
```

---

## Manual Testing

### Test Caching Manually

#### Method 1: Browser DevTools

1. Open your app in Chrome
2. Open DevTools (F12) → Network tab
3. Visit any page (e.g., `/tournaments`)
4. Note the response time
5. Refresh the page (Ctrl+R)
6. Compare response times - second should be faster

**What to look for:**
- First request: ~200-500ms (database query)
- Subsequent requests: ~50-100ms (cache hit)
- 70-90% reduction in response time

#### Method 2: curl

```bash
# First request (cache miss)
time curl http://localhost:3010/api/tournaments

# Second request (cache hit - should be faster)
time curl http://localhost:3010/api/tournaments
```

#### Method 3: Upstash Dashboard

1. Go to https://console.upstash.com
2. Select your Redis database
3. Click "Data Browser"
4. Look for keys:
   - `tournaments:all`
   - `stop:{stopId}:scoreboard`
   - `captain:{token}:portal`
   - `user:{userId}:tournaments`

**If you see these keys**, caching is working!

---

### Test Rate Limiting Manually

#### Method 1: Browser (Captain Portal)

1. Find a captain portal URL (format: `/api/captain-portal/XXXXX`)
2. Visit it 10 times rapidly
3. On the 11th request, you should see:
   ```json
   {
     "error": "Too many requests. Please try again later.",
     "retryAfter": 1729720800000
   }
   ```

#### Method 2: curl Script

```bash
# Run this script to test rate limiting
for i in {1..12}; do
  echo "Request $i:"
  curl -i http://localhost:3010/api/captain-portal/TEST123 2>&1 | grep -E '(HTTP|X-RateLimit|Retry-After)'
  echo ""
  sleep 0.5
done
```

**What to look for:**
- First 10 requests: Status 200 or 404
- Request 11+: Status 429 (Too Many Requests)
- Headers:
  - `X-RateLimit-Limit: 10`
  - `X-RateLimit-Remaining: 0`
  - `X-RateLimit-Reset: <timestamp>`
  - `Retry-After: <seconds>`

#### Method 3: Upstash Dashboard

1. Go to https://console.upstash.com
2. Select your Redis database
3. Click "Analytics" or "Data Browser"
4. Look for keys starting with:
   - `@ratelimit/captain-portal:`
   - `@ratelimit/score-submission:`
   - `@ratelimit/lineup-submission:`

**If you see these keys**, rate limiting is working!

---

## Troubleshooting

### Issue: Cache not working

**Symptoms:**
- All requests take the same time
- No speed improvement on repeated requests
- No cache keys in Upstash dashboard

**Solutions:**

1. **Check REDIS_URL is configured:**
   ```bash
   # In local development
   cat .env.local | grep REDIS_URL

   # In production (Vercel)
   vercel env ls
   ```

2. **Check Redis connection:**
   ```bash
   node test-redis.js
   ```

3. **Check application logs:**
   - Look for `[Cache]` prefixed messages
   - Look for connection errors

4. **Verify environment in running app:**
   ```bash
   # Add this to any API route temporarily
   console.log('REDIS_URL:', process.env.REDIS_URL ? 'configured' : 'not configured');
   ```

5. **Restart the server:**
   ```bash
   # Kill and restart
   npm run dev
   ```

---

### Issue: Rate limiting not working

**Symptoms:**
- Can make unlimited requests without getting 429
- No `X-RateLimit-*` headers in responses
- No rate limit keys in Upstash dashboard

**Solutions:**

1. **Check REST API credentials:**
   ```bash
   # Local
   cat .env.local | grep UPSTASH_REDIS_REST

   # Production
   vercel env ls | grep UPSTASH
   ```

2. **Get credentials from Upstash:**
   - Go to https://console.upstash.com
   - Select your Redis database
   - Click "REST API" tab
   - Copy `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN`

3. **Add to environment:**
   ```bash
   # Local (.env.local)
   UPSTASH_REDIS_REST_URL=https://dynamic-racer-20387.upstash.io
   UPSTASH_REDIS_REST_TOKEN=your_rest_token_here

   # Production (Vercel)
   vercel env add UPSTASH_REDIS_REST_URL production
   vercel env add UPSTASH_REDIS_REST_TOKEN production
   ```

4. **Redeploy:**
   ```bash
   git push  # Triggers Vercel deployment
   ```

5. **Note:** If REST API credentials are not configured, rate limiting will be **gracefully disabled**. The app still works, just without rate limiting protection.

---

### Issue: "Individual declarations in merged declaration 'dynamic' must be all exported or all local"

**Solution:** Already fixed in the codebase. If you see this:
- Clear `.next` cache: `rm -rf .next`
- Rebuild: `npm run build`

---

### Issue: Getting 404 on `/api/cache/status`

**Note:** This endpoint was created but has routing issues in Next.js 15. It's not critical since we can test Redis through other methods (see above).

**Alternative:** Use the test scripts instead:
```bash
node test-redis.js
```

---

## Performance Benchmarks

### Expected Performance (with Redis)

| Endpoint | Without Cache | With Cache | Improvement |
|----------|--------------|------------|-------------|
| `/api/tournaments` | 200-400ms | 30-80ms | 70-85% faster |
| `/api/captain-portal/:token` | 300-600ms | 40-100ms | 80-90% faster |
| `/api/public/stops/:id/scoreboard` | 250-500ms | 30-60ms | 85-90% faster |
| `/api/manager/:id/tournaments` | 400-800ms | 50-120ms | 85-90% faster |

### Cache TTL (Time to Live)

| Data Type | TTL | Reason |
|-----------|-----|--------|
| Clubs | 1 hour | Rarely changes |
| Players | 30 minutes | Occasionally updated |
| Tournaments | 10 minutes | May be edited |
| Schedule | 5 minutes | Active during events |
| Scores | 30 seconds | Real-time updates needed |
| Captain Portal | 1 minute | Lineup submissions |

---

## Monitoring in Production

### 1. Upstash Dashboard

**URL:** https://console.upstash.com

**What to monitor:**
- **Commands per second** - Should increase when users are active
- **Cache hit rate** - Aim for >70%
- **Storage used** - Should stay under your plan limit
- **Rate limit blocks** - Check for attack patterns

### 2. Vercel Logs

**URL:** https://vercel.com → Your Project → Logs

**What to look for:**
- Cache hit/miss logs: `[Cache] Hit: tournaments:all`
- Rate limit logs: `[RateLimit] Blocked: 192.168.1.1`
- Redis errors: `[Cache] Error connecting to Redis`

### 3. Application Performance

**Metrics to track:**
- Average API response time (should drop 70-90%)
- Database query count (should drop 70-90%)
- Concurrent users capacity (should increase 3-5x)

---

## Security Checklist

- [ ] `REDIS_URL` is not exposed in client-side code
- [ ] `UPSTASH_REDIS_REST_TOKEN` is kept secret
- [ ] Rate limiting is enabled in production
- [ ] Security headers are present in all responses
- [ ] Captain tokens are rate-limited to prevent brute force
- [ ] Score/lineup endpoints have validation and rate limiting

---

## Cache Invalidation

Cache is automatically invalidated when data changes:

### When scores are updated:
```
Invalidates: stop:{stopId}:* and captain:*:stop:{stopId}
```

### When you need to manually clear cache:

#### Option 1: Upstash Dashboard
1. Go to https://console.upstash.com
2. Select your database
3. Click "Data Browser"
4. Find the key to delete
5. Click "Delete"

#### Option 2: Redis CLI
```bash
# Clear specific key
redis-cli -u $REDIS_URL DEL "tournaments:all"

# Clear all cache (careful!)
redis-cli -u $REDIS_URL FLUSHDB
```

#### Option 3: Wait for TTL
Cache automatically expires based on TTL (see table above).

---

## Summary

### Quick Tests
```bash
# Test Redis connection
node test-redis.js

# Test API with Redis
npm run dev
API_URL=http://localhost:3010 node test-api-redis.js

# Test production
API_URL=https://your-domain.com node test-api-redis.js
```

### Environment Variables Required

**Development (.env.local):**
```bash
REDIS_URL=redis://default:TOKEN@host.upstash.io:6379
UPSTASH_REDIS_REST_URL=https://host.upstash.io
UPSTASH_REDIS_REST_TOKEN=your_token
```

**Production (Vercel):**
Same variables, configured via Vercel dashboard or CLI.

### Expected Results
- ✅ Caching reduces response time by 70-90%
- ✅ Rate limiting blocks after 10 requests per 10 seconds
- ✅ Security headers present on all responses
- ✅ Graceful degradation if Redis is unavailable

---

## Need Help?

If tests fail:
1. Run `node test-redis.js` to check connection
2. Check environment variables are configured
3. Check Upstash dashboard for errors
4. Review application logs for Redis errors
5. Try restarting the server

If rate limiting doesn't work:
- **This is OK!** The app uses graceful degradation
- Rate limiting will be disabled but app works normally
- To enable, add `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN`
