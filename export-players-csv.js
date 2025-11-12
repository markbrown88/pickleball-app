const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const prisma = new PrismaClient();

async function main() {
  console.log('Fetching all players from database...');

  const players = await prisma.player.findMany({
    include: {
      club: {
        select: {
          name: true,
          fullName: true
        }
      }
    },
    orderBy: [
      { lastName: 'asc' },
      { firstName: 'asc' }
    ]
  });

  console.log(`Found ${players.length} players`);

  // CSV Headers
  const headers = [
    'ID',
    'First Name',
    'Last Name',
    'Full Name',
    'Email',
    'Phone',
    'Gender',
    'Club ID',
    'Club Name',
    'City',
    'Region',
    'Country',
    'Age',
    'Birthday',
    'DUPR Overall',
    'DUPR Singles',
    'DUPR Doubles',
    'Club Rating Singles',
    'Club Rating Doubles',
    'Display Age',
    'Display Location',
    'Clerk User ID',
    'Is App Admin',
    'Disabled',
    'Disabled At',
    'Disabled By',
    'Created At',
    'Updated At'
  ];

  // Escape CSV field
  const escapeCSV = (field) => {
    if (field === null || field === undefined) return '';
    const str = String(field);
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  // Format date
  const formatDate = (date) => {
    if (!date) return '';
    return new Date(date).toISOString();
  };

  // Build CSV rows
  const rows = players.map(player => [
    player.id,
    player.firstName || '',
    player.lastName || '',
    player.name || '',
    player.email || '',
    player.phone || '',
    player.gender || '',
    player.clubId || '',
    player.club?.name || '',
    player.city || '',
    player.region || '',
    player.country || '',
    player.age || '',
    player.birthday ? formatDate(player.birthday) : '',
    player.dupr || '',
    player.duprSingles || '',
    player.duprDoubles || '',
    player.clubRatingSingles || '',
    player.clubRatingDoubles || '',
    player.displayAge ? 'Yes' : 'No',
    player.displayLocation ? 'Yes' : 'No',
    player.clerkUserId || '',
    player.isAppAdmin ? 'Yes' : 'No',
    player.disabled ? 'Yes' : 'No',
    player.disabledAt ? formatDate(player.disabledAt) : '',
    player.disabledBy || '',
    formatDate(player.createdAt),
    formatDate(player.updatedAt)
  ].map(escapeCSV));

  // Combine headers and rows
  const csv = [
    headers.join(','),
    ...rows.map(row => row.join(','))
  ].join('\n');

  // Write to file
  const filename = `players-export-${new Date().toISOString().split('T')[0]}.csv`;
  fs.writeFileSync(filename, csv, 'utf8');

  console.log(`\n✅ Export complete!`);
  console.log(`📄 File: ${filename}`);
  console.log(`📊 Total players: ${players.length}`);

  // Print summary stats
  const stats = {
    total: players.length,
    withEmail: players.filter(p => p.email).length,
    male: players.filter(p => p.gender === 'MALE').length,
    female: players.filter(p => p.gender === 'FEMALE').length,
    admins: players.filter(p => p.isAppAdmin).length,
    disabled: players.filter(p => p.disabled).length,
    withDUPR: players.filter(p => p.dupr).length
  };

  console.log('\n📈 Summary:');
  console.log(`   Total players: ${stats.total}`);
  console.log(`   With email: ${stats.withEmail}`);
  console.log(`   Male: ${stats.male}`);
  console.log(`   Female: ${stats.female}`);
  console.log(`   Admins: ${stats.admins}`);
  console.log(`   Disabled: ${stats.disabled}`);
  console.log(`   With DUPR rating: ${stats.withDUPR}`);
}

main()
  .catch(e => console.error('Error:', e))
  .finally(() => prisma.$disconnect());
