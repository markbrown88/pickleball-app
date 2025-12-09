import { PrismaClient } from '@prisma/client';
import { config } from 'dotenv';
import { resolve } from 'path';

config({ path: resolve(process.cwd(), '.env.local') });

const prisma = new PrismaClient();

async function verifyMerges() {
  const accounts = [
    { id: 'cmfpbp714000frdn0vzptthnv', name: 'Ben Cates (delete)' },
    { id: 'cmig3q9p30001l104hj83r6jj', name: 'Benjamin Cates (keep)' },
    { id: 'cmfpbp8iu002xrdn0bt0vx780', name: 'Matthew Kiss (delete)' },
    { id: 'cmig2f4la0001ks04yp62yvpu', name: 'Matt Kiss (keep)' },
    { id: 'cmgp4kiun0001jl047v4jrqtz', name: 'Ed Soptic (delete)' },
    { id: 'cmigyqogx0001jo04sk00unxc', name: 'Edward Soptic (keep)' },
  ];

  console.log('\n=== Verifying Merges ===\n');

  for (const account of accounts) {
    const p = await prisma.player.findUnique({
      where: { id: account.id },
      select: { id: true, firstName: true, lastName: true, clerkUserId: true, email: true }
    });
    
    if (p) {
      console.log(`✅ ${account.name}: ${p.firstName} ${p.lastName} (Clerk: ${p.clerkUserId ? 'Yes' : 'No'}, Email: ${p.email || 'N/A'})`);
    } else {
      console.log(`❌ ${account.name}: NOT FOUND (successfully deleted)`);
    }
  }

  await prisma.$disconnect();
}

verifyMerges();


