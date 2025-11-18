import * as dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const stripeKey = process.env.STRIPE_SECRET_KEY || '';
const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET || '';
const appUrl = process.env.NEXT_PUBLIC_APP_URL || '';

console.log('Stripe Configuration Verification\n');
console.log('='.repeat(80));

// Check Stripe Secret Key
console.log('\n1. STRIPE_SECRET_KEY:');
if (!stripeKey) {
  console.log('   ❌ NOT SET');
} else {
  const isTest = stripeKey.startsWith('sk_test_');
  const isLive = stripeKey.startsWith('sk_live_');
  const keyType = isTest ? 'TEST' : isLive ? 'LIVE' : 'UNKNOWN';
  const keyPreview = stripeKey.substring(0, 20) + '...';
  
  console.log(`   Key Type: ${keyType}`);
  console.log(`   Key Preview: ${keyPreview}`);
  
  // Determine environment
  const isLocalhost = appUrl.includes('localhost') || appUrl.includes('127.0.0.1');
  const isProduction = appUrl.includes('klyngcup.com') || !isLocalhost;
  
  console.log(`   Environment: ${isLocalhost ? 'LOCALHOST' : isProduction ? 'PRODUCTION' : 'UNKNOWN'}`);
  
  if (isLocalhost && !isTest) {
    console.log('   ⚠️  WARNING: Localhost should use TEST keys (sk_test_...)');
  } else if (isProduction && !isLive) {
    console.log('   ⚠️  WARNING: Production should use LIVE keys (sk_live_...)');
  } else {
    console.log('   ✅ Key type matches environment');
  }
}

// Check Webhook Secret
console.log('\n2. STRIPE_WEBHOOK_SECRET:');
if (!webhookSecret) {
  console.log('   ❌ NOT SET');
} else {
  const isTestWebhook = webhookSecret.startsWith('whsec_');
  const secretPreview = webhookSecret.substring(0, 20) + '...';
  
  console.log(`   Secret Type: ${isTestWebhook ? 'TEST/CLI' : 'UNKNOWN'}`);
  console.log(`   Secret Preview: ${secretPreview}`);
  console.log('   ✅ Set (verify it matches your Stripe webhook endpoint)');
}

// Check App URL
console.log('\n3. NEXT_PUBLIC_APP_URL:');
if (!appUrl) {
  console.log('   ❌ NOT SET');
} else {
  console.log(`   URL: ${appUrl}`);
  const isLocalhost = appUrl.includes('localhost') || appUrl.includes('127.0.0.1');
  const isProduction = appUrl.includes('klyngcup.com');
  
  if (isLocalhost) {
    console.log('   Environment: LOCALHOST');
    console.log('   ✅ Should use test Stripe keys');
  } else if (isProduction) {
    console.log('   Environment: PRODUCTION');
    console.log('   ✅ Should use live Stripe keys');
  } else {
    console.log('   Environment: UNKNOWN');
  }
}

// Summary
console.log('\n\n' + '='.repeat(80));
console.log('SUMMARY');
console.log('='.repeat(80));

const isLocalhost = appUrl.includes('localhost') || appUrl.includes('127.0.0.1');
const isTestKey = stripeKey.startsWith('sk_test_');
const isLiveKey = stripeKey.startsWith('sk_live_');

if (isLocalhost && isTestKey) {
  console.log('\n✅ Configuration is correct for localhost:');
  console.log('   - Using TEST Stripe keys');
  console.log('   - Sessions created will be cs_test_...');
  console.log('   - This is correct for local development');
} else if (isLocalhost && isLiveKey) {
  console.log('\n⚠️  MISCONFIGURATION DETECTED:');
  console.log('   - Localhost is using LIVE Stripe keys');
  console.log('   - This will create real charges!');
  console.log('   - Switch to TEST keys (sk_test_...) for localhost');
} else if (!isLocalhost && isLiveKey) {
  console.log('\n✅ Configuration is correct for production:');
  console.log('   - Using LIVE Stripe keys');
  console.log('   - Sessions created will be cs_live_...');
  console.log('   - This is correct for production');
} else if (!isLocalhost && isTestKey) {
  console.log('\n⚠️  MISCONFIGURATION DETECTED:');
  console.log('   - Production is using TEST Stripe keys');
  console.log('   - Payments will be test payments only');
  console.log('   - Switch to LIVE keys (sk_live_...) for production');
} else {
  console.log('\n⚠️  Unable to verify configuration');
  console.log('   - Check your environment variables');
}

console.log('\n');

