import * as dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

async function checkClerkAuthMethod(clerkUserId: string) {
  const clerkSecretKey = process.env.CLERK_SECRET_KEY;
  
  if (!clerkSecretKey) {
    console.error('CLERK_SECRET_KEY is not set in environment variables');
    process.exit(1);
  }

  try {
    // Clerk API endpoint to get user details
    const url = `https://api.clerk.com/v1/users/${clerkUserId}`;
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${clerkSecretKey}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Error fetching Clerk user: ${response.status} ${response.statusText}`);
      console.error(`Response: ${errorText}`);
      return null;
    }

    const user = await response.json();
    
    console.log(`\nClerk User ID: ${clerkUserId}`);
    console.log(`Email Addresses:`);
    user.email_addresses?.forEach((email: any, idx: number) => {
      console.log(`  ${idx + 1}. ${email.email_address} (${email.verification?.status || 'unknown'})`);
    });
    
    console.log(`\nExternal Accounts (OAuth/SSO):`);
    if (user.external_accounts && user.external_accounts.length > 0) {
      user.external_accounts.forEach((account: any, idx: number) => {
        console.log(`  ${idx + 1}. Provider: ${account.provider}`);
        console.log(`     Email: ${account.email_address || 'N/A'}`);
        console.log(`     Verified: ${account.verification?.status || 'unknown'}`);
        console.log(`     Created: ${account.created_at ? new Date(account.created_at).toISOString() : 'N/A'}`);
      });
    } else {
      console.log(`  None (email/password account)`);
    }
    
    console.log(`\nPassword:`);
    if (user.password_enabled) {
      console.log(`  Password is enabled (email/password account)`);
    } else {
      console.log(`  No password set (SSO-only account)`);
    }
    
    console.log(`\nAccount Created: ${user.created_at ? new Date(user.created_at).toISOString() : 'N/A'}`);
    console.log(`Last Sign In: ${user.last_sign_in_at ? new Date(user.last_sign_in_at).toISOString() : 'Never'}`);
    
    // Determine authentication method
    console.log(`\n📊 Authentication Method:`);
    if (user.external_accounts && user.external_accounts.length > 0) {
      const providers = user.external_accounts.map((acc: any) => acc.provider).join(', ');
      console.log(`  ✅ SSO Account (${providers})`);
      if (user.external_accounts.some((acc: any) => acc.provider === 'oauth_google')) {
        console.log(`  📧 Primary Email from Google: ${user.external_accounts.find((acc: any) => acc.provider === 'oauth_google')?.email_address || 'N/A'}`);
      }
    } else if (user.password_enabled) {
      console.log(`  ✅ Email/Password Account`);
    } else {
      console.log(`  ⚠️  Unknown (no password, no external accounts)`);
    }
    
    return user;
  } catch (error) {
    console.error('Error checking Clerk account:', error);
    return null;
  }
}

async function main() {
  const args = process.argv.slice(2);
  
  if (args.length === 0) {
    console.log('Usage: npx tsx scripts/check-clerk-auth-method.ts <clerkUserId>');
    console.log('Example: npx tsx scripts/check-clerk-auth-method.ts user_35cZB4xXpAskBPU6mcUqhDJIogP');
    process.exit(1);
  }

  const clerkUserId = args[0];
  await checkClerkAuthMethod(clerkUserId);
}

main();

