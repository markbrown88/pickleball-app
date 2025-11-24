import { PrismaClient } from '@prisma/client';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const prisma = new PrismaClient();

interface Player {
  id: string;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  phone: string | null;
  clubId: string;
  clerkUserId: string | null;
  createdAt: Date;
}

function normalizePhone(phone: string | null): string | null {
  if (!phone) return null;
  // Remove all non-digit characters
  return phone.replace(/\D/g, '');
}

function isInitialOrPlaceholder(name: string | null): boolean {
  if (!name) return true;
  const trimmed = name.trim();
  // Check if it's a single character, ?, or common placeholders
  return trimmed.length === 0 ||
         trimmed.length === 1 ||
         trimmed === '?' ||
         trimmed.toLowerCase() === 'unknown' ||
         trimmed.toLowerCase() === 'n/a';
}

function namesAreSimilar(name1: string | null, name2: string | null): boolean {
  if (!name1 || !name2) return false;

  const n1 = name1.toLowerCase().trim();
  const n2 = name2.toLowerCase().trim();

  // Exact match
  if (n1 === n2) return true;

  // One is a prefix of the other (e.g., "Pat" and "Patricia")
  if (n1.startsWith(n2) || n2.startsWith(n1)) return true;

  // Check for common nickname patterns
  const nicknames: { [key: string]: string[] } = {
    'patricia': ['pat', 'patti', 'patty', 'tricia'],
    'robert': ['rob', 'bob', 'bobby'],
    'william': ['will', 'bill', 'billy'],
    'richard': ['rick', 'dick', 'ricky'],
    'elizabeth': ['liz', 'beth', 'betty', 'betsy'],
    'jennifer': ['jen', 'jenny'],
    'michael': ['mike', 'mikey'],
    'christopher': ['chris'],
    'matthew': ['matt'],
    'anthony': ['tony'],
    'joseph': ['joe', 'joey'],
    'daniel': ['dan', 'danny'],
  };

  for (const [full, nicks] of Object.entries(nicknames)) {
    if ((n1 === full && nicks.includes(n2)) || (n2 === full && nicks.includes(n1))) {
      return true;
    }
  }

  return false;
}

async function findDuplicates() {
  try {
    console.log('='.repeat(80));
    console.log('DUPLICATE PLAYER ACCOUNT DETECTION');
    console.log('='.repeat(80));
    console.log('\nFetching all players...\n');

    const players = await prisma.player.findMany({
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        phone: true,
        clubId: true,
        clerkUserId: true,
        createdAt: true,
      },
      orderBy: [
        { lastName: 'asc' },
        { firstName: 'asc' },
      ],
    });

    console.log(`Found ${players.length} total players\n`);

    const potentialDuplicates: Array<{
      players: Player[];
      reason: string;
      confidence: 'HIGH' | 'MEDIUM' | 'LOW';
    }> = [];

    // Check for duplicates
    for (let i = 0; i < players.length; i++) {
      for (let j = i + 1; j < players.length; j++) {
        const p1 = players[i];
        const p2 = players[j];

        // Skip if different clubs (unless they have matching email/phone)
        const sameClub = p1.clubId === p2.clubId;
        const matchingEmail = p1.email && p2.email && p1.email.toLowerCase() === p2.email.toLowerCase();
        const matchingPhone = normalizePhone(p1.phone) && normalizePhone(p2.phone) &&
                              normalizePhone(p1.phone) === normalizePhone(p2.phone);

        if (!sameClub && !matchingEmail && !matchingPhone) {
          continue;
        }

        const reasons: string[] = [];
        let confidence: 'HIGH' | 'MEDIUM' | 'LOW' = 'LOW';

        // Check for exact email match
        if (matchingEmail) {
          reasons.push('Same email');
          confidence = 'HIGH';
        }

        // Check for phone match
        if (matchingPhone) {
          reasons.push('Same phone');
          confidence = 'HIGH';
        }

        // Check last name
        const lastNameMatch = p1.lastName && p2.lastName &&
                             p1.lastName.toLowerCase().trim() === p2.lastName.toLowerCase().trim();

        if (!lastNameMatch) continue; // Skip if last names don't match

        // Check first name patterns
        const fn1 = p1.firstName;
        const fn2 = p2.firstName;

        // Both first names are the same
        if (fn1 && fn2 && fn1.toLowerCase().trim() === fn2.toLowerCase().trim()) {
          reasons.push('Same first and last name');
          if (confidence !== 'HIGH') confidence = 'HIGH';
        }
        // One or both first names are initials/placeholders
        else if (isInitialOrPlaceholder(fn1) || isInitialOrPlaceholder(fn2)) {
          reasons.push('Same last name, one has initial/blank first name');
          if (confidence !== 'HIGH') confidence = 'MEDIUM';
        }
        // First names are similar (nicknames, etc)
        else if (namesAreSimilar(fn1, fn2)) {
          reasons.push('Same last name, similar first names');
          if (confidence !== 'HIGH') confidence = 'MEDIUM';
        }
        // Just same last name with different first names
        else {
          // Don't flag these unless there's another match
          if (reasons.length === 0) continue;
        }

        // Add same club as additional indicator
        if (sameClub && !reasons.includes('Same email') && !reasons.includes('Same phone')) {
          reasons.push('Same club');
        }

        if (reasons.length > 0) {
          potentialDuplicates.push({
            players: [p1, p2],
            reason: reasons.join(', '),
            confidence,
          });
        }
      }
    }

    // Sort by confidence
    potentialDuplicates.sort((a, b) => {
      const order = { HIGH: 0, MEDIUM: 1, LOW: 2 };
      return order[a.confidence] - order[b.confidence];
    });

    console.log('='.repeat(80));
    console.log(`FOUND ${potentialDuplicates.length} POTENTIAL DUPLICATE PAIRS`);
    console.log('='.repeat(80));

    // Group by confidence
    const high = potentialDuplicates.filter(d => d.confidence === 'HIGH');
    const medium = potentialDuplicates.filter(d => d.confidence === 'MEDIUM');
    const low = potentialDuplicates.filter(d => d.confidence === 'LOW');

    if (high.length > 0) {
      console.log(`\n🔴 HIGH CONFIDENCE DUPLICATES (${high.length})`);
      console.log('='.repeat(80));
      for (const dup of high) {
        printDuplicate(dup);
      }
    }

    if (medium.length > 0) {
      console.log(`\n🟡 MEDIUM CONFIDENCE DUPLICATES (${medium.length})`);
      console.log('='.repeat(80));
      for (const dup of medium) {
        printDuplicate(dup);
      }
    }

    if (low.length > 0) {
      console.log(`\n🟢 LOW CONFIDENCE DUPLICATES (${low.length})`);
      console.log('='.repeat(80));
      for (const dup of low) {
        printDuplicate(dup);
      }
    }

    if (potentialDuplicates.length === 0) {
      console.log('\n✅ No potential duplicates found!');
    }

    // Summary with IDs for easy merging
    if (high.length > 0) {
      console.log('\n' + '='.repeat(80));
      console.log('HIGH CONFIDENCE DUPLICATES - USER IDs FOR MERGING');
      console.log('='.repeat(80));
      for (const dup of high) {
        const [p1, p2] = dup.players;
        console.log(`\n${p1.firstName || '?'} ${p1.lastName || '?'} vs ${p2.firstName || '?'} ${p2.lastName || '?'}`);
        console.log(`User 1: ${p1.id} (${p1.email || 'no email'}) - Created ${p1.createdAt.toISOString().split('T')[0]}`);
        console.log(`User 2: ${p2.id} (${p2.email || 'no email'}) - Created ${p2.createdAt.toISOString().split('T')[0]}`);
      }
    }

  } finally {
    await prisma.$disconnect();
  }
}

function printDuplicate(dup: { players: Player[]; reason: string; confidence: string }) {
  const [p1, p2] = dup.players;

  console.log('\n---');
  console.log(`Confidence: ${dup.confidence} | Reason: ${dup.reason}`);
  console.log(`\nPlayer 1: ${p1.firstName || '(blank)'} ${p1.lastName || '(blank)'}`);
  console.log(`  ID: ${p1.id}`);
  console.log(`  Email: ${p1.email || 'N/A'}`);
  console.log(`  Phone: ${p1.phone || 'N/A'}`);
  console.log(`  Clerk: ${p1.clerkUserId ? 'Yes' : 'No'}`);
  console.log(`  Created: ${p1.createdAt.toISOString().split('T')[0]}`);

  console.log(`\nPlayer 2: ${p2.firstName || '(blank)'} ${p2.lastName || '(blank)'}`);
  console.log(`  ID: ${p2.id}`);
  console.log(`  Email: ${p2.email || 'N/A'}`);
  console.log(`  Phone: ${p2.phone || 'N/A'}`);
  console.log(`  Clerk: ${p2.clerkUserId ? 'Yes' : 'No'}`);
  console.log(`  Created: ${p2.createdAt.toISOString().split('T')[0]}`);
}

findDuplicates();
