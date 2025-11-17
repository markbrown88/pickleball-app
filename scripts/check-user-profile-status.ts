import { PrismaClient } from '@prisma/client';

// Load environment variables from .env.local
import { config } from 'dotenv';
import { resolve } from 'path';
config({ path: resolve(process.cwd(), '.env.local') });

const prisma = new PrismaClient();

async function checkUserProfileStatus(email: string) {
  try {
    console.log(`\n=== Checking User Profile Status ===\n`);
    console.log(`Email: ${email}\n`);

    // Check Player record in database
    const player = await prisma.player.findUnique({
      where: { email: email.toLowerCase() },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        name: true,
        email: true,
        clerkUserId: true,
        createdAt: true,
        updatedAt: true,
        clubId: true,
        club: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    if (!player) {
      console.log(`❌ No Player record found for ${email}`);
      console.log(`   This user does not exist in the database`);
      return;
    }

    console.log(`✅ Player Record Found:`);
    console.log(`   Player ID: ${player.id}`);
    console.log(`   Name: ${player.name || `${player.firstName} ${player.lastName}`}`);
    console.log(`   First Name: ${player.firstName || 'None'}`);
    console.log(`   Last Name: ${player.lastName || 'None'}`);
    console.log(`   Email: ${player.email}`);
    console.log(`   Club: ${player.club?.name || 'None'} (ID: ${player.clubId || 'None'})`);
    console.log(`   Created At: ${player.createdAt.toISOString()}`);
    console.log(`   Updated At: ${player.updatedAt.toISOString()}`);

    // Check Clerk connection
    console.log(`\n🔐 Clerk Account Status:`);
    if (player.clerkUserId) {
      console.log(`   Clerk User ID: ${player.clerkUserId}`);
      console.log(`   ✅ Player is linked to Clerk account`);
      console.log(`   Status: User has logged in and account is connected`);
      
      // Try to check Clerk user details (if we have Clerk SDK access)
      // Note: This would require Clerk API key and SDK
      console.log(`\n   Note: To check password/SSO status, you would need to check Clerk dashboard`);
      console.log(`   or use Clerk Management API with appropriate credentials`);
    } else {
      console.log(`   Clerk User ID: None`);
      console.log(`   ❌ Player is NOT linked to Clerk account`);
      console.log(`   Status: Profile only - user has never logged in`);
      console.log(`\n   When user logs in:`);
      console.log(`   - If they use email/password: Clerk will create account, webhook should link it`);
      console.log(`   - If they use Google SSO: Clerk will create account, webhook should link it`);
      console.log(`   - The Player record should be matched by email and clerkUserId updated`);
    }

    // Check for registrations
    const registrations = await prisma.tournamentRegistration.findMany({
      where: { playerId: player.id },
      include: {
        tournament: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: {
        registeredAt: 'desc',
      },
    });

    console.log(`\n📋 Registrations:`);
    if (registrations.length === 0) {
      console.log(`   No registrations found`);
    } else {
      console.log(`   Found ${registrations.length} registration(s):`);
      for (const reg of registrations) {
        console.log(`   - ${reg.tournament.name}`);
        console.log(`     Status: ${reg.status}`);
        console.log(`     Payment Status: ${reg.paymentStatus}`);
        console.log(`     Registered: ${reg.registeredAt.toISOString()}`);
      }
    }

    // Summary
    console.log(`\n📊 Summary:`);
    if (player.clerkUserId) {
      console.log(`   ✅ User has logged in and has Clerk account`);
      console.log(`   ✅ Profile is connected to Clerk`);
      console.log(`   ℹ️  To check password vs SSO: Check Clerk dashboard`);
    } else {
      console.log(`   ⚠️  User has NOT logged in yet`);
      console.log(`   ✅ Profile exists and will be matched by email when user logs in`);
      console.log(`   📝 This is a 'profile' user (created manually, not logged in)`);
    }

  } catch (error: any) {
    console.error(`\n❌ Error:`, error.message);
    if (error.stack) {
      console.error(error.stack);
    }
  } finally {
    await prisma.$disconnect();
  }
}

const email = process.argv[2];
if (!email) {
  console.error('Usage: npx tsx scripts/check-user-profile-status.ts <email>');
  console.error('Example: npx tsx scripts/check-user-profile-status.ts christyk464@gmail.com');
  process.exit(1);
}

checkUserProfileStatus(email)
  .then(() => {
    console.log('\n✅ Complete');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Failed:', error);
    process.exit(1);
  });

