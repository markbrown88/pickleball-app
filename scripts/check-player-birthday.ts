import { PrismaClient } from '@prisma/client';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const prisma = new PrismaClient();

async function checkPlayerBirthday(email: string) {
  try {
    const player = await prisma.player.findUnique({
      where: { email: email.toLowerCase() },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        birthday: true,
        birthdayYear: true,
        birthdayMonth: true,
        birthdayDay: true,
        age: true,
      },
    });

    if (!player) {
      console.log(`Player not found for email: ${email}`);
      return;
    }

    console.log('\n=== Player Birthday Data ===');
    console.log(`Name: ${player.firstName} ${player.lastName}`);
    console.log(`Email: ${player.email}`);
    console.log(`\nDatabase Fields:`);
    console.log(`  birthday (Date): ${player.birthday}`);
    console.log(`  birthdayYear: ${player.birthdayYear}`);
    console.log(`  birthdayMonth: ${player.birthdayMonth}`);
    console.log(`  birthdayDay: ${player.birthdayDay}`);
    console.log(`  age: ${player.age}`);
    
    if (player.birthday) {
      console.log(`\nParsed birthday:`);
      console.log(`  ISO String: ${player.birthday.toISOString()}`);
      console.log(`  YYYY-MM-DD: ${player.birthday.toISOString().slice(0, 10)}`);
      console.log(`  Local Date: ${player.birthday.toLocaleDateString()}`);
    } else {
      console.log(`\n⚠️  birthday field is NULL`);
    }

    // Check what the API would return
    console.log(`\n=== What API Returns ===`);
    const apiResponse = {
      birthday: player.birthday,
    };
    console.log(`Raw API response:`, JSON.stringify(apiResponse, null, 2));
    
    // Simulate JSON serialization
    const serialized = JSON.parse(JSON.stringify(apiResponse));
    console.log(`After JSON serialization:`, serialized);
    console.log(`Type: ${typeof serialized.birthday}`);
    
    if (serialized.birthday) {
      console.log(`Value: ${serialized.birthday}`);
      console.log(`Slice(0, 10): ${serialized.birthday.slice(0, 10)}`);
    }

  } catch (error) {
    console.error('Error checking player birthday:', error);
  } finally {
    await prisma.$disconnect();
  }
}

const email = process.argv[2] || 'lily226@gmail.com';
checkPlayerBirthday(email);

