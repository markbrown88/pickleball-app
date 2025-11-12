# Email Testing Guide

## Quick Test

### 1. Check Email Service Configuration
```bash
# Visit in browser or use curl:
GET http://localhost:3010/api/test/email
```

This will show:
- Whether `RESEND_API_KEY` is configured
- Current email service status
- From address configuration

### 2. Send a Test Email

**Option A: Simple Test Email**
```bash
POST http://localhost:3010/api/test/email
Content-Type: application/json

{
  "to": "your-email@example.com",
  "type": "simple"
}
```

**Option B: Registration Confirmation Test**
```bash
POST http://localhost:3010/api/test/email
Content-Type: application/json

{
  "to": "your-email@example.com",
  "type": "registration"
}
```

### 3. Check Server Logs

When you register for a tournament, check your server console for:
- `[Registration] Attempting to send confirmation email` - Shows email attempt
- `[Email sent successfully]` - Email was sent via Resend
- `[DEV: email] Email would be sent` - Email was logged (not sent) because RESEND_API_KEY is missing

## Common Issues

### Issue: Emails Not Being Sent

**Symptom**: No emails received, but registration works

**Check:**
1. Is `RESEND_API_KEY` set in `.env.local`?
   ```bash
   # Check if it exists
   echo $RESEND_API_KEY
   ```

2. Check server logs for:
   - `RESEND_API_KEY not configured` - Key is missing
   - `[Email send failed]` - Key is set but sending failed

3. Does the player have an email address?
   - Check logs for: `[Registration] Skipping email - missing data`
   - Verify player profile has email set

### Issue: RESEND_API_KEY Not Configured

**Solution:**
1. Sign up for Resend account: https://resend.com
2. Get your API key from Resend dashboard
3. Add to `.env.local`:
   ```
   RESEND_API_KEY=re_xxxxxxxxxxxxx
   ```
4. Restart your dev server

### Issue: Emails Going to Spam

**Solution:**
- Resend requires domain verification for production
- In development, emails may go to spam
- Check spam folder
- Consider using Resend's test mode or verified domain

## Testing Registration Email Flow

1. Register for a tournament via the UI
2. Check server console logs - you should see:
   ```
   [Registration] Attempting to send confirmation email
   [Email sent successfully] OR [DEV: email] Email would be sent
   ```
3. Check your email inbox (and spam folder)
4. If using test endpoint, check the response for status

## Next Steps

Once emails are working:
1. ✅ Test registration confirmation emails
2. ✅ Test admin notification emails  
3. ⏳ Implement payment receipt emails (webhook handler)
4. ⏳ Implement payment failed emails (webhook handler)
5. ⏳ Implement refund confirmation emails (webhook handler)

