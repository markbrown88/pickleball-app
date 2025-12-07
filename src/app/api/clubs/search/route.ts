import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
    const searchParams = request.nextUrl.searchParams;
    const query = searchParams.get('q');

    if (!query || query.length < 3) {
        return NextResponse.json({ clubs: [] });
    }

    try {
        const clubs = await prisma.club.findMany({
            where: {
                OR: [
                    { name: { contains: query, mode: 'insensitive' } },
                    { city: { contains: query, mode: 'insensitive' } },
                ],
                // Exclude completely inactive/deleted clubs if we had a soft delete, 
                // but currently all statuses are visible
            },
            select: {
                id: true,
                name: true,
                city: true,
                region: true,
                directorId: true,
                directors: {
                    select: { playerId: true } // Just need count/existence
                }
            },
            take: 20
        });

        const formattedClubs = clubs.map(club => ({
            id: club.id,
            name: club.name,
            city: club.city || '',
            region: club.region || '',
            // Claimable if NO legacy director AND NO new directors
            isClaimable: !club.directorId && club.directors.length === 0
        }));

        return NextResponse.json({ clubs: formattedClubs });

    } catch (error) {
        console.error('Club search error:', error);
        return NextResponse.json({ error: 'Failed to search clubs' }, { status: 500 });
    }
}
