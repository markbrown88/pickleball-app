export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { formatPhoneForDisplay, formatPhoneForStorage } from '@/lib/phone';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    let playerId = searchParams.get('playerId');

    // If no playerId provided, try to get from authenticated user
    if (!playerId) {
      const { currentUser } = await import('@clerk/nextjs/server');
      const user = await currentUser();
      if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }

      const player = await prisma.player.findUnique({
        where: { clerkUserId: user.id },
        include: {
          club: {
            select: {
              id: true,
              name: true,
              city: true,
              region: true,
            }
          }
        }
      });

      if (!player) {
        return NextResponse.json({ error: 'Player profile not found' }, { status: 404 });
      }

      // Format response to match UserProfile type
      const response = {
        id: player.id,
        clerkUserId: player.clerkUserId || '',
        firstName: player.firstName,
        lastName: player.lastName,
        name: player.name,
        email: player.email,
        phone: formatPhoneForDisplay(player.phone),
        gender: player.gender,
        dupr: player.dupr,
        duprSingles: player.duprSingles,
        duprDoubles: player.duprDoubles,
        clubRatingSingles: player.clubRatingSingles,
        clubRatingDoubles: player.clubRatingDoubles,
        age: player.age,
        birthday: player.birthday,
        city: player.city,
        region: player.region,
        country: player.country,
        displayAge: player.displayAge,
        displayLocation: player.displayLocation,
        isAppAdmin: player.isAppAdmin,
        isTournamentAdmin: false, // TODO: check tournament admin status
        club: player.club
      };

      return NextResponse.json(response);
    }

    // Legacy: Get by playerId (for backward compatibility)
    const player = await prisma.player.findUnique({ where: { id: playerId } });
    if (!player) return NextResponse.json({ error: 'not found' }, { status: 404 });

    const teams = await prisma.teamPlayer.findMany({
      where: { playerId },
      include: {
        team: { include: { captain: true } }
      }
    });

    const stops = await prisma.stopTeamPlayer.findMany({
      where: { playerId },
      include: {
        stop: { include: { tournament: true } },
        team: { include: { captain: true } }
      },
      orderBy: { createdAt: 'desc' }
    });

    return NextResponse.json({
      player,
      teams: teams.map(x => x.team),
      stops
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    // Use singleton prisma instance
    const body = (await req.json()) as { playerId?: string; name?: string; gender?: 'MALE'|'FEMALE' };
    if (!body?.playerId || !body?.name || !body?.gender) {
      return NextResponse.json({ error: 'playerId, name, gender required' }, { status: 400 });
    }
    const p = await prisma.player.update({
      where: { id: body.playerId },
      data: { name: body.name.trim(), gender: body.gender }
    });
    return NextResponse.json(p);
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  try {
    const body = await req.json();
    const {
      playerId,
      firstName,
      lastName,
      email,
      phone,
      gender,
      clubId,
      city,
      region,
      country,
      birthday,
      duprSingles,
      duprDoubles,
      clubRatingSingles,
      clubRatingDoubles,
      displayAge,
      displayLocation
    } = body;

    if (!playerId) {
      return NextResponse.json({ error: 'playerId required' }, { status: 400 });
    }

    // Build update data object
    const updateData: any = {};

    if (firstName !== undefined) updateData.firstName = firstName?.trim() || null;
    if (lastName !== undefined) updateData.lastName = lastName?.trim() || null;
    if (email !== undefined) updateData.email = email?.trim() || null;
    if (phone !== undefined) {
      updateData.phone = phone ? formatPhoneForStorage(phone) : null;
    }
    if (gender !== undefined) updateData.gender = gender;
    if (clubId !== undefined) updateData.clubId = clubId;
    if (city !== undefined) updateData.city = city?.trim() || null;
    if (region !== undefined) updateData.region = region?.trim() || null;
    if (country !== undefined) updateData.country = country || 'Canada';
    if (birthday !== undefined) updateData.birthday = birthday ? new Date(birthday) : null;

    // Rating fields - convert strings to floats
    if (duprSingles !== undefined) {
      updateData.duprSingles = duprSingles ? parseFloat(duprSingles) : null;
    }
    if (duprDoubles !== undefined) {
      updateData.duprDoubles = duprDoubles ? parseFloat(duprDoubles) : null;
    }
    if (clubRatingSingles !== undefined) {
      updateData.clubRatingSingles = clubRatingSingles ? parseFloat(clubRatingSingles) : null;
    }
    if (clubRatingDoubles !== undefined) {
      updateData.clubRatingDoubles = clubRatingDoubles ? parseFloat(clubRatingDoubles) : null;
    }

    // Privacy settings
    if (displayAge !== undefined) updateData.displayAge = displayAge;
    if (displayLocation !== undefined) updateData.displayLocation = displayLocation;

    try {
      const player = await prisma.player.update({
        where: { id: playerId },
        data: updateData,
        include: {
          club: {
            select: {
              id: true,
              name: true,
              city: true,
              region: true,
            }
          }
        }
      });

      // Format response to match UserProfile type
      const response = {
        id: player.id,
        clerkUserId: player.clerkUserId || '',
        firstName: player.firstName,
        lastName: player.lastName,
        name: player.name,
        email: player.email,
        phone: formatPhoneForDisplay(player.phone),
        gender: player.gender,
        dupr: player.dupr,
        duprSingles: player.duprSingles,
        duprDoubles: player.duprDoubles,
        clubRatingSingles: player.clubRatingSingles,
        clubRatingDoubles: player.clubRatingDoubles,
        age: player.age,
        birthday: player.birthday,
        city: player.city,
        region: player.region,
        country: player.country,
        displayAge: player.displayAge,
        displayLocation: player.displayLocation,
        isAppAdmin: player.isAppAdmin,
        isTournamentAdmin: false, // TODO: check tournament admin status
        club: player.club
      };

      return NextResponse.json(response);
    } catch (updateError: any) {
      if (updateError?.code === 'P2002') {
        return NextResponse.json({ error: 'A player with that email address already exists' }, { status: 409 });
      }
      throw updateError;
    }
  } catch (e) {
    console.error('Error updating player profile:', e);
    const msg = e instanceof Error ? e.message : 'error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
