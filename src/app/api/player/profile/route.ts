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

      // Construct birthday from year/month/day if birthday Date is null but fields exist
      let birthday = player.birthday;
      if (!birthday && player.birthdayYear && player.birthdayMonth && player.birthdayDay) {
        // Create Date from year/month/day (use UTC to avoid timezone issues)
        birthday = new Date(Date.UTC(player.birthdayYear, player.birthdayMonth - 1, player.birthdayDay));
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
        dupr: player.duprDoubles ?? null, // Map duprDoubles to dupr for backward compatibility
        duprSingles: player.duprSingles,
        duprDoubles: player.duprDoubles,
        clubRatingSingles: player.clubRatingSingles,
        clubRatingDoubles: player.clubRatingDoubles,
        age: player.age,
        birthday: birthday,
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
    
    // Update name field if firstName or lastName changed
    if (firstName !== undefined || lastName !== undefined) {
      const fn = firstName !== undefined ? (firstName?.trim() || null) : undefined;
      const ln = lastName !== undefined ? (lastName?.trim() || null) : undefined;
      
      // Get current values if not provided
      if (fn === undefined || ln === undefined) {
        const currentPlayer = await prisma.player.findUnique({
          where: { id: playerId },
          select: { firstName: true, lastName: true },
        });
        const finalFirstName = fn !== undefined ? fn : (currentPlayer?.firstName || null);
        const finalLastName = ln !== undefined ? ln : (currentPlayer?.lastName || null);
        const nameParts = [finalFirstName, finalLastName].filter(Boolean);
        updateData.name = nameParts.length > 0 ? nameParts.join(' ') : null;
      } else {
        const nameParts = [fn, ln].filter(Boolean);
        updateData.name = nameParts.length > 0 ? nameParts.join(' ') : null;
      }
    }
    
    if (email !== undefined) updateData.email = email?.trim() || null;
    if (phone !== undefined) {
      updateData.phone = phone ? formatPhoneForStorage(phone) : null;
    }
    if (gender !== undefined) updateData.gender = gender;
    if (clubId !== undefined) updateData.clubId = clubId;
    if (city !== undefined) updateData.city = city?.trim() || null;
    if (region !== undefined) updateData.region = region?.trim() || null;
    if (country !== undefined) updateData.country = country || 'Canada';
    
    // Handle birthday update - extract year/month/day and calculate age
    if (birthday !== undefined) {
      const birthdayDate = birthday ? new Date(birthday) : null;
      updateData.birthday = birthdayDate;
      
      if (birthdayDate && !isNaN(birthdayDate.getTime())) {
        // Extract year/month/day from Date
        updateData.birthdayYear = birthdayDate.getUTCFullYear();
        updateData.birthdayMonth = birthdayDate.getUTCMonth() + 1; // getUTCMonth() returns 0-11
        updateData.birthdayDay = birthdayDate.getUTCDate();
        
        // Calculate and store age
        const today = new Date();
        let age = today.getFullYear() - updateData.birthdayYear;
        const mm = updateData.birthdayMonth - 1;
        if (today.getMonth() < mm || (today.getMonth() === mm && today.getDate() < updateData.birthdayDay)) {
          age -= 1;
        }
        updateData.age = age;
      } else {
        // Clear birthday fields if birthday is null
        updateData.birthdayYear = null;
        updateData.birthdayMonth = null;
        updateData.birthdayDay = null;
        updateData.age = null;
      }
    }

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

      // Construct birthday from year/month/day if birthday Date is null but fields exist
      let birthday = player.birthday;
      if (!birthday && player.birthdayYear && player.birthdayMonth && player.birthdayDay) {
        // Create Date from year/month/day (use UTC to avoid timezone issues)
        birthday = new Date(Date.UTC(player.birthdayYear, player.birthdayMonth - 1, player.birthdayDay));
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
        dupr: player.duprDoubles ?? null, // Map duprDoubles to dupr for backward compatibility
        duprSingles: player.duprSingles,
        duprDoubles: player.duprDoubles,
        clubRatingSingles: player.clubRatingSingles,
        clubRatingDoubles: player.clubRatingDoubles,
        age: player.age,
        birthday: birthday,
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
