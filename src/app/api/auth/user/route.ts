import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/prisma';
import { getEffectivePlayer, getActAsHeaderFromRequest } from '@/lib/actAs';

/**
 * GET /api/auth/user
 * Get current authenticated user's player profile (supports Act As)
 */
export async function GET(req: NextRequest) {
  try {
    // Check if Clerk is properly configured
    if (!process.env.CLERK_SECRET_KEY) {
      console.error('CLERK_SECRET_KEY is not set');
      return NextResponse.json({ error: 'Authentication service not configured' }, { status: 500 });
    }

    // Get the authenticated user ID first
    const { userId } = await auth();
    console.log('Auth API: Authenticated user ID:', userId);

    if (!userId) {
      console.log('Auth API: No authenticated user');
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    // Check if user has a player record
    const existingPlayer = await prisma.player.findUnique({
      where: { clerkUserId: userId },
      include: {
        club: {
          select: {
            id: true,
            name: true,
            city: true,
            region: true
          }
        }
      }
    });

    console.log('Auth API: Existing player found:', !!existingPlayer);

    if (!existingPlayer) {
      console.log('Auth API: No player record found for user:', userId);
      return NextResponse.json({ error: 'Player profile not found. Please complete your profile setup.' }, { status: 404 });
    }

    // Support Act As functionality (only if player exists)
    const actAsPlayerId = getActAsHeaderFromRequest(req);
    let effectivePlayer;
    
    try {
      effectivePlayer = await getEffectivePlayer(actAsPlayerId);
    } catch (actAsError) {
      console.log('Auth API: Act As error, using real player:', actAsError);
      // If Act As fails, just use the real player
      effectivePlayer = {
        realUserId: userId,
        realPlayerId: existingPlayer.id,
        isActingAs: false,
        targetPlayerId: existingPlayer.id,
        isAppAdmin: existingPlayer.isAppAdmin
      };
    }

    // Find player record for the effective player (real user or target if acting as)
    const player = await prisma.player.findUnique({
      where: { id: effectivePlayer.targetPlayerId },
      include: {
        club: {
          select: {
            id: true,
            name: true,
            city: true,
            region: true
          }
        }
      }
    });

    if (!player) {
      console.log('Auth API: Target player not found:', effectivePlayer.targetPlayerId);
      return NextResponse.json({ error: 'Player profile not found' }, { status: 404 });
    }

    return NextResponse.json({
      id: player.id,
      clerkUserId: player.clerkUserId,
      firstName: player.firstName,
      lastName: player.lastName,
      name: player.name,
      email: player.email,
      phone: player.phone,
      gender: player.gender,
      dupr: player.dupr,
      age: player.age,
      birthday: player.birthday,
      city: player.city,
      region: player.region,
      country: player.country,
      club: player.club,
      isAppAdmin: player.isAppAdmin
    });
  } catch (error) {
    console.error('Error fetching user profile:', error);
    console.error('Error details:', {
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      name: error instanceof Error ? error.name : undefined
    });
    return NextResponse.json(
      { error: 'Failed to fetch user profile', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/auth/user
 * Create or link a player profile to a Clerk user
 */
export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth();
    
    if (!userId) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const body = await req.json();
    const {
      firstName,
      lastName,
      gender,
      clubId,
      email,
      phone,
      city,
      region,
      country = 'Canada',
      dupr,
      birthday
    } = body;

    // Validate required fields
    if (!firstName || !lastName || !gender || !clubId) {
      return NextResponse.json(
        { error: 'firstName, lastName, gender, and clubId are required' },
        { status: 400 }
      );
    }

    // Validate gender
    if (!['MALE', 'FEMALE'].includes(gender)) {
      return NextResponse.json(
        { error: 'gender must be MALE or FEMALE' },
        { status: 400 }
      );
    }

    // Check if club exists
    const club = await prisma.club.findUnique({
      where: { id: clubId },
      select: { id: true, name: true }
    });

    if (!club) {
      return NextResponse.json({ error: 'Club not found' }, { status: 404 });
    }

    // Check if user already has a player profile
    const existingPlayer = await prisma.player.findUnique({
      where: { clerkUserId: userId }
    });

    if (existingPlayer) {
      return NextResponse.json(
        { error: 'Player profile already exists for this user' },
        { status: 409 }
      );
    }

    // Check if a player with this email already exists in the database
    if (email?.trim()) {
      const existingPlayerByEmail = await prisma.player.findUnique({
        where: { email: email.trim() }
      });

      if (existingPlayerByEmail) {
        // Link the existing player to this Clerk user
        const updatedPlayer = await prisma.player.update({
          where: { id: existingPlayerByEmail.id },
          data: { clerkUserId: userId },
          include: {
            club: {
              select: {
                id: true,
                name: true,
                city: true,
                region: true
              }
            }
          }
        });

        return NextResponse.json({
          id: updatedPlayer.id,
          clerkUserId: updatedPlayer.clerkUserId,
          firstName: updatedPlayer.firstName,
          lastName: updatedPlayer.lastName,
          name: updatedPlayer.name,
          email: updatedPlayer.email,
          phone: updatedPlayer.phone,
          gender: updatedPlayer.gender,
          dupr: updatedPlayer.dupr,
          age: updatedPlayer.age,
          birthday: updatedPlayer.birthday,
          city: updatedPlayer.city,
          region: updatedPlayer.region,
          country: updatedPlayer.country,
          club: updatedPlayer.club,
          isAppAdmin: updatedPlayer.isAppAdmin
        }, { status: 200 });
      }
    }

    // Parse birthday if provided
    let birthdayYear = null;
    let birthdayMonth = null;
    let birthdayDay = null;
    let birthdayDate = null;

    if (birthday) {
      const date = new Date(birthday);
      if (!isNaN(date.getTime())) {
        birthdayYear = date.getFullYear();
        birthdayMonth = date.getMonth() + 1;
        birthdayDay = date.getDate();
        birthdayDate = date;
      }
    }

    // Create player profile
    const player = await prisma.player.create({
      data: {
        clerkUserId: userId,
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        name: `${firstName.trim()} ${lastName.trim()}`,
        gender,
        clubId,
        email: email?.trim() || null,
        phone: phone?.trim() || null,
        city: city?.trim() || null,
        region: region?.trim() || null,
        country: country.trim(),
        dupr: dupr ? parseFloat(dupr) : null,
        birthdayYear,
        birthdayMonth,
        birthdayDay,
        birthday: birthdayDate
      },
      include: {
        club: {
          select: {
            id: true,
            name: true,
            city: true,
            region: true
          }
        }
      }
    });

    return NextResponse.json({
      id: player.id,
      clerkUserId: player.clerkUserId,
      firstName: player.firstName,
      lastName: player.lastName,
      name: player.name,
      email: player.email,
      phone: player.phone,
      gender: player.gender,
      dupr: player.dupr,
      age: player.age,
      birthday: player.birthday,
      city: player.city,
      region: player.region,
      country: player.country,
      club: player.club,
      isAppAdmin: player.isAppAdmin
    }, { status: 201 });
  } catch (error) {
    console.error('Error creating user profile:', error);
    return NextResponse.json(
      { error: 'Failed to create user profile' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/auth/user
 * Update current user's player profile
 */
export async function PUT(req: NextRequest) {
  try {
    const { userId } = await auth();
    
    if (!userId) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const body = await req.json();
    
    const {
      firstName,
      lastName,
      gender,
      clubId,
      email,
      phone,
      city,
      region,
      country,
      dupr,
      birthday
    } = body;

    // Find existing player
    const existingPlayer = await prisma.player.findUnique({
      where: { clerkUserId: userId }
    });

    if (!existingPlayer) {
      return NextResponse.json(
        { error: 'Player profile not found' },
        { status: 404 }
      );
    }

    // Validate gender if provided
    if (gender && !['MALE', 'FEMALE'].includes(gender)) {
      return NextResponse.json(
        { error: 'gender must be MALE or FEMALE' },
        { status: 400 }
      );
    }

    // Check if club exists if clubId is provided and not empty
    if (clubId && clubId.trim() !== '') {
      const club = await prisma.club.findUnique({
        where: { id: clubId },
        select: { id: true }
      });

      if (!club) {
        return NextResponse.json({ error: 'Club not found' }, { status: 404 });
      }
    }

    // Parse birthday if provided
    let birthdayYear = existingPlayer.birthdayYear;
    let birthdayMonth = existingPlayer.birthdayMonth;
    let birthdayDay = existingPlayer.birthdayDay;
    let birthdayDate = existingPlayer.birthday;

    if (birthday) {
      const date = new Date(birthday);
      if (!isNaN(date.getTime())) {
        birthdayYear = date.getFullYear();
        birthdayMonth = date.getMonth() + 1;
        birthdayDay = date.getDate();
        birthdayDate = date;
      }
    }

    // Update player profile
    const updateData = {
      ...(firstName && { firstName: firstName.trim() }),
      ...(lastName && { lastName: lastName.trim() }),
      ...(firstName && lastName && { name: `${firstName.trim()} ${lastName.trim()}` }),
      ...(gender && { gender }),
      ...(clubId !== undefined && clubId && clubId.trim() !== '' && { clubId: clubId.trim() }),
      ...(email !== undefined && { email: email?.trim() || null }),
      ...(phone !== undefined && { phone: phone?.trim() || null }),
      ...(city !== undefined && { city: city?.trim() || null }),
      ...(region !== undefined && { region: region?.trim() || null }),
      ...(country && { country: country.trim() }),
      ...(dupr !== undefined && { dupr: dupr ? parseFloat(dupr) : null }),
      ...(birthday && {
        birthdayYear,
        birthdayMonth,
        birthdayDay,
        birthday: birthdayDate
      })
    };
    
    
    
    const updatedPlayer = await prisma.player.update({
      where: { clerkUserId: userId },
      data: updateData,
      include: {
        club: {
          select: {
            id: true,
            name: true,
            city: true,
            region: true
          }
        }
      }
    });


    return NextResponse.json({
      id: updatedPlayer.id,
      clerkUserId: updatedPlayer.clerkUserId,
      firstName: updatedPlayer.firstName,
      lastName: updatedPlayer.lastName,
      name: updatedPlayer.name,
      email: updatedPlayer.email,
      phone: updatedPlayer.phone,
      gender: updatedPlayer.gender,
      dupr: updatedPlayer.dupr,
      age: updatedPlayer.age,
      birthday: updatedPlayer.birthday,
      city: updatedPlayer.city,
      region: updatedPlayer.region,
      country: updatedPlayer.country,
      club: updatedPlayer.club,
      isAppAdmin: updatedPlayer.isAppAdmin
    });
  } catch (error) {
    console.error('Error updating user profile:', error);
    return NextResponse.json(
      { error: 'Failed to update user profile' },
      { status: 500 }
    );
  }
}

