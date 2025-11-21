import { PrismaClient } from '@prisma/client';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const prisma = new PrismaClient();

function computeAge(y?: number | null, m?: number | null, d?: number | null): number | null {
  if (!y || !m || !d) return null;
  try {
    const today = new Date();
    let age = today.getFullYear() - y;
    const mm = m - 1;
    if (today.getMonth() < mm || (today.getMonth() === mm && today.getDate() < d)) age -= 1;
    return age;
  } catch {
    return null;
  }
}

async function checkPlayerAge(email: string) {
  try {
    console.log(`\n=== Checking Age for ${email} ===\n`);

    const player = await prisma.player.findUnique({
      where: { email },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        name: true,
        email: true,
        birthday: true,
        birthdayYear: true,
        birthdayMonth: true,
        birthdayDay: true,
        age: true,
      },
    });

    if (!player) {
      console.log(`❌ Player not found with email: ${email}`);
      return;
    }

    console.log(`Player: ${player.name || `${player.firstName} ${player.lastName}`}`);
    console.log(`Email: ${player.email}`);
    console.log(`\nBirthday Fields:`);
    console.log(`   birthday (Date): ${player.birthday ? player.birthday.toISOString() : 'null'}`);
    console.log(`   birthdayYear: ${player.birthdayYear ?? 'null'}`);
    console.log(`   birthdayMonth: ${player.birthdayMonth ?? 'null'}`);
    console.log(`   birthdayDay: ${player.birthdayDay ?? 'null'}`);
    console.log(`   age (stored): ${player.age ?? 'null'}`);

    // Calculate age from birthday fields
    const calculatedAge = computeAge(player.birthdayYear, player.birthdayMonth, player.birthdayDay);
    
    console.log(`\n📊 AGE CALCULATION:`);
    if (calculatedAge !== null) {
      console.log(`   Calculated Age: ${calculatedAge} years old`);
      
      if (player.birthdayYear && player.birthdayMonth && player.birthdayDay) {
        const today = new Date();
        const birthDate = new Date(player.birthdayYear, player.birthdayMonth - 1, player.birthdayDay);
        const nextBirthday = new Date(today.getFullYear(), player.birthdayMonth - 1, player.birthdayDay);
        if (nextBirthday < today) {
          nextBirthday.setFullYear(nextBirthday.getFullYear() + 1);
        }
        const daysUntilBirthday = Math.ceil((nextBirthday.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
        
        console.log(`   Birth Date: ${birthDate.toLocaleDateString()}`);
        console.log(`   Days until next birthday: ${daysUntilBirthday}`);
      }
    } else {
      console.log(`   ❌ Cannot calculate age - missing birthday data`);
    }

    if (player.age !== null && calculatedAge !== null && player.age !== calculatedAge) {
      console.log(`\n⚠️  WARNING: Stored age (${player.age}) differs from calculated age (${calculatedAge})`);
    }

  } catch (error) {
    console.error('Error checking player age:', error);
  } finally {
    await prisma.$disconnect();
  }
}

const email = process.argv[2] || 'markbrown8@gmail.com';
checkPlayerAge(email);

