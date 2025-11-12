# Resend Domain Configuration Guide

## Quick Start: Using Resend's Test Domain (No Setup Required)

For **testing/development**, you can use Resend's built-in test domain without any configuration:

**Add to `.env.local`:**
```
RESEND_FROM_ADDRESS=Tournaments <onboarding@resend.dev>
```

This works immediately - no domain verification needed! Perfect for development and testing.

---

## Production: Adding Your Own Domain

### Step 1: Add Domain in Resend Dashboard

1. **Log in to Resend**: https://resend.com
2. **Navigate to**: **Settings** → **Domains** (or go directly to https://resend.com/domains)
3. **Click**: **"Add Domain"** button
4. **Enter your domain**: e.g., `yourdomain.com` (without www or http://)
5. **Click**: **"Add Domain"**

### Step 2: Verify Domain with DNS Records

Resend will show you DNS records to add. You need to add these to your domain's DNS settings:

**Required Records:**
- **SPF Record** (TXT): `v=spf1 include:_spf.resend.com ~all`
- **DKIM Record** (TXT): Resend provides a unique DKIM key
- **DMARC Record** (TXT): Optional but recommended

**Where to add DNS records:**
- Go to your domain registrar (GoDaddy, Namecheap, Cloudflare, etc.)
- Find DNS Management / DNS Settings
- Add the TXT records Resend provides

### Step 3: Wait for Verification

- Resend will automatically verify your domain (usually takes a few minutes)
- Check status in Resend dashboard - it will show "Verified" when ready
- You'll see a green checkmark ✅ when verified

### Step 4: Update Your Environment Variable

Once verified, update `.env.local`:
```
RESEND_FROM_ADDRESS=Tournaments <no-reply@yourdomain.com>
```

Or use any subdomain:
```
RESEND_FROM_ADDRESS=Tournaments <noreply@yourdomain.com>
RESEND_FROM_ADDRESS=Tournaments <tournaments@yourdomain.com>
```

---

## Common Domain Providers

### Cloudflare
1. Go to your domain → DNS → Records
2. Click "Add record"
3. Type: TXT
4. Name: `@` (or subdomain)
5. Content: Paste the DNS record from Resend
6. Save

### GoDaddy
1. Go to Domain Manager → DNS
2. Click "Add" under Records
3. Type: TXT
4. Host: `@` (or subdomain)
5. Value: Paste the DNS record from Resend
6. Save

### Namecheap
1. Go to Domain List → Manage → Advanced DNS
2. Click "Add New Record"
3. Type: TXT Record
4. Host: `@` (or subdomain)
5. Value: Paste the DNS record from Resend
6. Save

---

## Testing Your Domain

After adding DNS records:
1. Wait 5-10 minutes for DNS propagation
2. Check Resend dashboard - domain should show "Verified"
3. Send a test email using `/api/test/email`
4. Check your inbox - emails should arrive from your domain

---

## Troubleshooting

### Domain Not Verifying
- **Wait longer**: DNS changes can take up to 48 hours (usually much faster)
- **Check DNS records**: Make sure you copied them exactly from Resend
- **Use DNS checker**: Use https://mxtoolbox.com/ to verify records are live
- **Check for typos**: Domain name must match exactly

### Emails Going to Spam
- **Verify domain**: Unverified domains have higher spam rates
- **Add DMARC record**: Helps with deliverability
- **Warm up domain**: Send small batches initially
- **Check SPF/DKIM**: Both must be verified

### "Invalid from address" Error
- **Use verified domain**: Must use email from a verified domain
- **Check format**: Use format `Name <email@domain.com>`
- **No spaces**: Email address shouldn't have spaces

---

## Current Configuration

Your app will use:
1. `RESEND_FROM_ADDRESS` environment variable (if set)
2. `onboarding@resend.dev` as default (works immediately for testing)

**Recommended for development:**
```
RESEND_FROM_ADDRESS=Tournaments <onboarding@resend.dev>
```

**Recommended for production:**
```
RESEND_FROM_ADDRESS=Tournaments <no-reply@yourdomain.com>
```

