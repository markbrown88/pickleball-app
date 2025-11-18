import { PrismaClient } from '@prisma/client';
import * as dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const prisma = new PrismaClient();

async function findTournament() {
  try {
    // Search for tournaments with pickleplex in the name
    const tournaments = await prisma.tournament.findMany({
      where: {
        OR: [
          {
            name: {
              contains: 'pickleplex',
              mode: 'insensitive',
            },
          },
          {
            name: {
              contains: 'klyng',
              mode: 'insensitive',
            },
          },
        ],
      },
      include: {
        stops: {
          include: {
            club: {
              select: {
                name: true,
                id: true,
              },
            },
          },
          orderBy: {
            startAt: 'asc',
          },
        },
        brackets: {
          orderBy: {
            idx: 'asc',
          },
        },
      },
    });

    console.log(`Found ${tournaments.length} tournament(s):\n`);

    for (const tournament of tournaments) {
      console.log(`🏆 Tournament: ${tournament.name}`);
      console.log(`   ID: ${tournament.id}`);
      console.log(`   Type: ${tournament.type}`);
      console.log(`   Registration Type: ${tournament.registrationType}`);
      console.log('');

      console.log('📍 Stops:');
      tournament.stops.forEach(stop => {
        console.log(`   - ${stop.name} (ID: ${stop.id})`);
        console.log(`     Club: ${stop.club?.name || 'N/A'} (ID: ${stop.club?.id || 'N/A'})`);
        if (stop.startAt) {
          console.log(`     Start: ${new Date(stop.startAt).toLocaleDateString()}`);
        }
      });
      console.log('');

      console.log('📋 Brackets:');
      tournament.brackets.forEach(bracket => {
        console.log(`   - ${bracket.name} (ID: ${bracket.id}, idx: ${bracket.idx})`);
      });
      console.log('\n' + '='.repeat(80) + '\n');
    }

    // Get clubs
    const clubs = await prisma.club.findMany({
      where: {
        OR: [
          { name: { contains: 'Downsview', mode: 'insensitive' } },
          { name: { contains: 'Barrie', mode: 'insensitive' } },
          { name: { contains: 'Promenade', mode: 'insensitive' } },
          { name: { contains: 'Oshawa', mode: 'insensitive' } },
        ],
      },
      select: {
        id: true,
        name: true,
        city: true,
      },
    });

    console.log('🏢 Clubs Found:');
    clubs.forEach(club => {
      console.log(`   - ${club.name} (ID: ${club.id}) - ${club.city || 'N/A'}`);
    });

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

findTournament();

