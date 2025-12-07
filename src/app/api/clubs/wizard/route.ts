import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { auth } from '@clerk/nextjs/server';

export async function POST(request: NextRequest) {
    try {
        const { userId } = await auth();
        if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const body = await request.json();
        const { id, name, city, region, address } = body;

        // Find the player profile for the current user
        const player = await prisma.player.findUnique({
            where: { clerkUserId: userId },
            select: { id: true }
        });

        if (!player) {
            return NextResponse.json({ error: 'Player profile not found. Please complete your profile first.' }, { status: 400 });
        }

        let club;

        if (id) {
            // CLAIM EXISTING CLUB
            const existingClub = await prisma.club.findUnique({
                where: { id },
                include: { directors: true }
            });

            if (!existingClub) return NextResponse.json({ error: 'Club not found' }, { status: 404 });

            // Check if claimable
            if (existingClub.directorId || existingClub.directors.length > 0) {
                // Technically, if the current user IS the director, we could allow editing, 
                // but for "Signup Wizard", we assume they are taking ownership.
                const isAlreadyDirector = existingClub.directorId === player.id || existingClub.directors.some(d => d.playerId === player.id);

                if (!isAlreadyDirector) {
                    return NextResponse.json({ error: 'Club is already claimed.' }, { status: 403 });
                }
            }

            club = await prisma.club.update({
                where: { id },
                data: {
                    name,
                    city,
                    region,
                    address,
                    // We connect the legacy field for backward compat for now, or just leave it?
                    // If we want to strictly use new system, we should ignore directorId.
                    // But to be safe, let's set it if it's null.
                    directorId: existingClub.directorId ? undefined : player.id,
                    directors: {
                        connectOrCreate: {
                            where: {
                                clubId_playerId: {
                                    clubId: id,
                                    playerId: player.id
                                }
                            },
                            create: {
                                playerId: player.id,
                                role: 'ADMIN'
                            }
                        }
                    }
                }
            });

        } else {
            // CREATE NEW CLUB
            club = await prisma.club.create({
                data: {
                    name,
                    city,
                    region,
                    address,
                    status: 'ACTIVE',
                    directorId: player.id, // Legacy compat
                    directors: {
                        create: {
                            playerId: player.id,
                            role: 'ADMIN'
                        }
                    }
                }
            });
        }

        return NextResponse.json(club);

    } catch (error: any) {
        console.error('Wizard save error:', error);
        return NextResponse.json({ error: error.message || 'Failed to save club' }, { status: 500 });
    }
}
