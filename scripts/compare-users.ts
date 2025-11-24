import { PrismaClient } from '@prisma/client';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const prisma = new PrismaClient();

async function compareUsers() {
  try {
    const userId1 = 'cmiaj3qbv0001ld04r4dmcvuw';
    const userId2 = 'cmh822cep005jr0j4ro16a5e0';

    const [user1, user2] = await Promise.all([
      prisma.player.findUnique({
        where: { id: userId1 },
        include: { club: true },
      }),
      prisma.player.findUnique({
        where: { id: userId2 },
        include: { club: true },
      }),
    ]);

    if (!user1) {
      console.log(`\n❌ User 1 (${userId1}) not found`);
    }
    if (!user2) {
      console.log(`❌ User 2 (${userId2}) not found`);
    }

    if (!user1 || !user2) {
      return;
    }

    console.log('\n=== USER 1 ===');
    console.log(`ID: ${user1.id}`);
    console.log(`Name: ${user1.firstName} ${user1.lastName}`);
    console.log(`Email: ${user1.email || 'N/A'}`);
    console.log(`Phone: ${user1.phone || 'N/A'}`);
    console.log(`Gender: ${user1.gender}`);
    console.log(`Club: ${user1.club.name}`);
    console.log(`Birthday: ${user1.birthday || 'N/A'}`);
    console.log(`Clerk User ID: ${user1.clerkUserId || 'N/A'}`);
    console.log(`Created: ${user1.createdAt}`);
    console.log(`City: ${user1.city || 'N/A'}`);
    console.log(`Region: ${user1.region || 'N/A'}`);

    console.log('\n=== USER 2 ===');
    console.log(`ID: ${user2.id}`);
    console.log(`Name: ${user2.firstName} ${user2.lastName}`);
    console.log(`Email: ${user2.email || 'N/A'}`);
    console.log(`Phone: ${user2.phone || 'N/A'}`);
    console.log(`Gender: ${user2.gender}`);
    console.log(`Club: ${user2.club.name}`);
    console.log(`Birthday: ${user2.birthday || 'N/A'}`);
    console.log(`Clerk User ID: ${user2.clerkUserId || 'N/A'}`);
    console.log(`Created: ${user2.createdAt}`);
    console.log(`City: ${user2.city || 'N/A'}`);
    console.log(`Region: ${user2.region || 'N/A'}`);

    console.log('\n=== COMPARISON ===');
    const matches: string[] = [];
    const differences: string[] = [];

    // Compare fields
    if (user1.firstName?.toLowerCase() === user2.firstName?.toLowerCase()) {
      matches.push('✅ First name matches');
    } else {
      differences.push(`❌ First name: "${user1.firstName}" vs "${user2.firstName}"`);
    }

    if (user1.lastName?.toLowerCase() === user2.lastName?.toLowerCase()) {
      matches.push('✅ Last name matches');
    } else {
      differences.push(`❌ Last name: "${user1.lastName}" vs "${user2.lastName}"`);
    }

    if (user1.email?.toLowerCase() === user2.email?.toLowerCase()) {
      matches.push('✅ Email matches');
    } else {
      differences.push(`❌ Email: "${user1.email}" vs "${user2.email}"`);
    }

    if (user1.phone === user2.phone && user1.phone) {
      matches.push('✅ Phone matches');
    } else if (user1.phone || user2.phone) {
      differences.push(`❌ Phone: "${user1.phone || 'N/A'}" vs "${user2.phone || 'N/A'}"`);
    }

    if (user1.gender === user2.gender) {
      matches.push('✅ Gender matches');
    } else {
      differences.push(`❌ Gender: ${user1.gender} vs ${user2.gender}`);
    }

    if (user1.clubId === user2.clubId) {
      matches.push('✅ Club matches');
    } else {
      differences.push(`❌ Club: ${user1.club.name} vs ${user2.club.name}`);
    }

    const bd1 = user1.birthday?.toISOString().split('T')[0];
    const bd2 = user2.birthday?.toISOString().split('T')[0];
    if (bd1 === bd2 && bd1) {
      matches.push('✅ Birthday matches');
    } else if (bd1 || bd2) {
      differences.push(`❌ Birthday: ${bd1 || 'N/A'} vs ${bd2 || 'N/A'}`);
    }

    console.log('\nMatches:');
    matches.forEach(m => console.log(m));

    console.log('\nDifferences:');
    differences.forEach(d => console.log(d));

    // Check registrations
    const [reg1, reg2] = await Promise.all([
      prisma.tournamentRegistration.findMany({
        where: { playerId: userId1 },
        include: { tournament: true },
        orderBy: { registeredAt: 'desc' },
      }),
      prisma.tournamentRegistration.findMany({
        where: { playerId: userId2 },
        include: { tournament: true },
        orderBy: { registeredAt: 'desc' },
      }),
    ]);

    console.log(`\n=== REGISTRATIONS ===`);
    console.log(`User 1 registrations: ${reg1.length}`);
    reg1.forEach(r => {
      console.log(`  - ${r.tournament.name} (${r.status}, ${r.paymentStatus})`);
    });

    console.log(`\nUser 2 registrations: ${reg2.length}`);
    reg2.forEach(r => {
      console.log(`  - ${r.tournament.name} (${r.status}, ${r.paymentStatus})`);
    });

    // Check roster entries
    const [roster1, roster2] = await Promise.all([
      prisma.stopTeamPlayer.findMany({
        where: { playerId: userId1 },
        include: {
          stop: true,
          team: true,
        },
      }),
      prisma.stopTeamPlayer.findMany({
        where: { playerId: userId2 },
        include: {
          stop: true,
          team: true,
        },
      }),
    ]);

    console.log(`\n=== ROSTER ENTRIES ===`);
    console.log(`User 1 roster entries: ${roster1.length}`);
    roster1.forEach(r => {
      console.log(`  - ${r.stop.name} / ${r.team.name} (${r.paymentMethod})`);
    });

    console.log(`\nUser 2 roster entries: ${roster2.length}`);
    roster2.forEach(r => {
      console.log(`  - ${r.stop.name} / ${r.team.name} (${r.paymentMethod})`);
    });

    // Conclusion
    console.log('\n=== CONCLUSION ===');
    if (matches.length >= 3 && differences.length <= 2) {
      console.log('🟡 LIKELY DUPLICATE - Consider merging these accounts');
    } else if (differences.length === 0) {
      console.log('🔴 DEFINITE DUPLICATE - Same user registered twice');
    } else {
      console.log('🟢 DIFFERENT USERS - Not duplicates');
    }

  } finally {
    await prisma.$disconnect();
  }
}

compareUsers();
