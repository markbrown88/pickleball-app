import { PrismaClient } from '@prisma/client';
import * as dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const prisma = new PrismaClient();

async function lookupTournamentInfo() {
  try {
    // Find the tournament
    const tournament = await prisma.tournament.findFirst({
      where: {
        name: {
          contains: 'Klyng Cup',
          mode: 'insensitive',
        },
      },
      include: {
        stops: {
          include: {
            club: {
              select: {
                name: true,
              },
            },
          },
        },
        brackets: {
          orderBy: {
            idx: 'asc',
          },
        },
      },
    });

    if (!tournament) {
      console.log('❌ Tournament not found');
      return;
    }

    console.log('🏆 Tournament Found:');
    console.log(`   Name: ${tournament.name}`);
    console.log(`   ID: ${tournament.id}`);
    console.log(`   Type: ${tournament.type}`);
    console.log('');

    // Find Oshawa stop
    const oshawaStop = tournament.stops.find(stop => 
      stop.club?.name?.toLowerCase().includes('oshawa') ||
      stop.name?.toLowerCase().includes('oshawa')
    );

    if (!oshawaStop) {
      console.log('❌ Oshawa stop not found');
      console.log('\nAvailable stops:');
      tournament.stops.forEach(stop => {
        console.log(`   - ${stop.name} (ID: ${stop.id}) - Club: ${stop.club?.name || 'N/A'}`);
      });
      return;
    }

    console.log('📍 Oshawa Stop Found:');
    console.log(`   Name: ${oshawaStop.name}`);
    console.log(`   ID: ${oshawaStop.id}`);
    console.log(`   Club: ${oshawaStop.club?.name || 'N/A'}`);
    console.log('');

    // Show brackets
    console.log('📋 Tournament Brackets:');
    tournament.brackets.forEach(bracket => {
      console.log(`   - ${bracket.name} (ID: ${bracket.id}, idx: ${bracket.idx})`);
    });
    console.log('');

    // Get clubs
    const clubs = await prisma.club.findMany({
      where: {
        name: {
          in: ['Downsview', 'Barrie', 'Promenade', 'Oshawa'],
        },
      },
      select: {
        id: true,
        name: true,
      },
    });

    console.log('🏢 Clubs Found:');
    clubs.forEach(club => {
      console.log(`   - ${club.name} (ID: ${club.id})`);
    });

    const missingClubs = ['Downsview', 'Barrie', 'Promenade', 'Oshawa'].filter(
      name => !clubs.some(c => c.name === name)
    );

    if (missingClubs.length > 0) {
      console.log('\n⚠️  Missing Clubs:');
      missingClubs.forEach(name => {
        console.log(`   - ${name}`);
      });
    }

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

lookupTournamentInfo();

