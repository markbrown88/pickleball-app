/**
 * Script to check a user's role and permissions
 * Usage: npx tsx scripts/check-user-role.ts <email>
 */

import { prisma } from '../src/server/db';

async function checkUserRole(email: string) {
  const player = await prisma.player.findFirst({
    where: { email: email.toLowerCase() },
    include: {
      TournamentCaptain: { select: { tournamentId: true, tournament: { select: { name: true } } } },
      tournamentAdminLinks: { select: { tournamentId: true, tournament: { select: { name: true } } } },
      TournamentEventManager: { select: { tournamentId: true, tournament: { select: { name: true } } } },
    },
  });

  if (!player) {
    console.log('❌ Player not found with email:', email);
    return;
  }

  console.log('\n📋 Player Information:');
  console.log('ID:', player.id);
  console.log('Name:', player.firstName, player.lastName);
  console.log('Email:', player.email);
  console.log('');
  console.log('🔐 Roles:');
  console.log('  App Admin:', player.isAppAdmin ? '✅ YES' : '❌ No');
  console.log('  Tournament Admin:', player.tournamentAdminLinks.length > 0 ? `✅ YES (${player.tournamentAdminLinks.length} tournaments)` : '❌ No');
  console.log('  Event Manager:', player.TournamentEventManager.length > 0 ? `✅ YES (${player.TournamentEventManager.length} tournaments)` : '❌ No');
  console.log('  Captain:', player.TournamentCaptain.length > 0 ? `✅ YES (${player.TournamentCaptain.length} tournaments)` : '❌ No');

  // Determine effective role (using same logic as app)
  let effectiveRole = 'PLAYER';
  if (player.isAppAdmin) effectiveRole = 'APP_ADMIN';
  else if (player.tournamentAdminLinks.length > 0 || player.TournamentEventManager.length > 0) effectiveRole = 'TOURNAMENT_ADMIN';
  else if (player.TournamentCaptain.length > 0) effectiveRole = 'CAPTAIN';

  console.log('');
  console.log('🎯 Effective Role:', effectiveRole);

  if (player.TournamentCaptain.length > 0) {
    console.log('');
    console.log('🏆 Captain for:');
    player.TournamentCaptain.forEach(tc => {
      console.log('  -', tc.tournament.name);
    });
  }
}

const email = process.argv[2];
if (!email) {
  console.log('Usage: npx tsx scripts/check-user-role.ts <email>');
  process.exit(1);
}

checkUserRole(email)
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Error:', err);
    process.exit(1);
  });
