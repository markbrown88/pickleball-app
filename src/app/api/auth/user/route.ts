import { NextRequest, NextResponse } from 'next/server';
import { auth, currentUser } from '@clerk/nextjs/server';
import { prisma } from '@/lib/prisma';
import { getEffectivePlayer, getActAsHeaderFromRequest } from '@/lib/actAs';
import { formatPhoneForDisplay, formatPhoneForStorage } from '@/lib/phone';

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

    // Get the authenticated user ID and email
    const { userId } = await auth();
    console.log('Auth API: Authenticated user ID:', userId);

    if (!userId) {
      console.log('Auth API: No authenticated user');
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    // Get user email from Clerk
    const clerkUser = await currentUser();
    const userEmail = clerkUser?.emailAddresses?.[0]?.emailAddress;
    console.log('Auth API: User email from Clerk:', userEmail);

    // First, try to find player by Clerk user ID
    let player = await prisma.player.findUnique({
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

    console.log('Auth API: Player found by Clerk ID:', !!player);

    // If no player found by Clerk ID, check if one exists with the same email
    if (!player && userEmail) {
      console.log('Auth API: No player found by Clerk ID, checking by email:', userEmail);
      
      const existingPlayerByEmail = await prisma.player.findUnique({
        where: { email: userEmail },
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

      if (existingPlayerByEmail) {
        console.log('Auth API: Found existing player by email, updating Clerk ID. Player ID:', existingPlayerByEmail.id);
        
        // Update the existing player record with the new Clerk user ID
        player = await prisma.player.update({
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
        
        console.log('Auth API: Successfully merged user with existing player record. Updated player:', {
          id: player.id,
          name: player.name,
          email: player.email,
          clerkUserId: player.clerkUserId
        });
      } else {
        console.log('Auth API: No existing player found by email either');
      }
    }

    // If no player found, create one automatically (fallback if webhook didn't work)
    if (!player && userEmail) {
      console.log('Auth API: No player record found, creating one automatically for user:', userId);
      
      try {
        // Find a default club to assign to the new player
        const defaultClub = await prisma.club.findFirst({
          orderBy: { name: 'asc' },
          select: { id: true },
        });

        if (!defaultClub) {
          console.error('Auth API: No clubs found in database. Cannot create Player without a club.');
          return NextResponse.json({ 
            error: 'Player profile not found', 
            needsProfileSetup: true,
            message: 'Please complete your profile setup to continue.' 
          }, { status: 404 });
        }

        // Get name from Clerk user
        const firstName = clerkUser?.firstName || null;
        const lastName = clerkUser?.lastName || null;
        const name = firstName && lastName ? `${firstName} ${lastName}` : firstName || lastName || null;

        // Create the player record
        player = await prisma.player.create({
          data: {
            clerkUserId: userId,
            email: userEmail.toLowerCase(),
            firstName,
            lastName,
            name,
            gender: 'MALE', // Default, can be updated later
            country: 'Canada', // Default for this application
            clubId: defaultClub.id, // Required field - assign to first available club
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

        console.log('Auth API: Successfully created Player record automatically:', {
          id: player.id,
          email: player.email,
          clerkUserId: player.clerkUserId
        });
        
        // Mark that this player needs profile setup since it was auto-created with defaults
        return NextResponse.json({
          id: player.id,
          clerkUserId: player.clerkUserId,
          firstName: player.firstName,
          lastName: player.lastName,
          name: player.name,
          email: player.email,
          phone: formatPhoneForDisplay(player.phone),
          gender: player.gender,
          dupr: player.dupr,
          age: player.age,
          birthday: player.birthday,
          city: player.city,
          region: player.region,
          country: player.country,
          club: player.club,
          isAppAdmin: player.isAppAdmin,
          needsProfileSetup: true, // Signal that profile needs to be completed
        });
      } catch (createError: any) {
        console.error('Auth API: Error creating Player record automatically:', createError);
        // If creation fails, return error (don't crash)
        return NextResponse.json({ 
          error: 'Failed to create player profile', 
          needsProfileSetup: true,
          message: 'Please complete your profile setup to continue.' 
        }, { status: 500 });
      }
    }

    if (!player) {
      console.log('Auth API: No player record found for user:', userId);
      return NextResponse.json({ 
        error: 'Player profile not found', 
        needsProfileSetup: true,
        message: 'Please complete your profile setup to continue.' 
      }, { status: 404 });
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
        realPlayerId: player.id,
        isActingAs: false,
        targetPlayerId: player.id,
        isAppAdmin: player.isAppAdmin
      };
    }

    // Find player record for the effective player (real user or target if acting as)
    const finalPlayer = await prisma.player.findUnique({
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

    if (!finalPlayer) {
      console.log('Auth API: Target player not found:', effectivePlayer.targetPlayerId);
      return NextResponse.json({ error: 'Player profile not found' }, { status: 404 });
    }

    // Check if player needs profile setup (minimum required: firstName, lastName, clubId)
    // This is the minimum required to access the app - other fields can be added later
    const needsProfileSetup = 
      !finalPlayer.firstName || 
      !finalPlayer.lastName || 
      !finalPlayer.clubId;

    return NextResponse.json({
      id: finalPlayer.id,
      clerkUserId: finalPlayer.clerkUserId,
      firstName: finalPlayer.firstName,
      lastName: finalPlayer.lastName,
      name: finalPlayer.name,
      email: finalPlayer.email,
      phone: formatPhoneForDisplay(finalPlayer.phone),
      gender: finalPlayer.gender,
      dupr: finalPlayer.dupr,
      age: finalPlayer.age,
      birthday: finalPlayer.birthday,
      city: finalPlayer.city,
      region: finalPlayer.region,
      country: finalPlayer.country,
      club: finalPlayer.club,
      isAppAdmin: finalPlayer.isAppAdmin,
      needsProfileSetup: needsProfileSetup || undefined, // Only include if true
    });
  } catch (error) {
    console.error('Error fetching user profile:', error);
    return NextResponse.json(
      { error: 'Failed to fetch user profile' },
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
          phone: formatPhoneForDisplay(updatedPlayer.phone),
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
        phone: phone ? formatPhoneForStorage(phone) : null,
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
      phone: formatPhoneForDisplay(player.phone),
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

    // Handle birthday updates
    if (birthday !== undefined) {
      if (birthday && birthday.trim() !== '') {
        const date = new Date(birthday);
        if (!isNaN(date.getTime())) {
          birthdayYear = date.getFullYear();
          birthdayMonth = date.getMonth() + 1;
          birthdayDay = date.getDate();
          birthdayDate = date;
        }
      } else {
        // Clear birthday if empty string provided
        birthdayYear = null;
        birthdayMonth = null;
        birthdayDay = null;
        birthdayDate = null;
      }
    }

    // Format phone number safely
    let formattedPhone: string | null = null;
    if (phone !== undefined) {
      try {
        if (phone && typeof phone === 'string' && phone.trim()) {
          formattedPhone = formatPhoneForStorage(phone);
        } else {
          formattedPhone = null;
        }
      } catch (phoneError: any) {
        console.error('Error formatting phone number:', phoneError);
        // If phone formatting fails, just use null or the original value
        formattedPhone = null;
      }
    }

    // Validate and prepare update data
    const updateData: any = {};
    
    if (firstName !== undefined) {
      if (typeof firstName === 'string' && firstName.trim()) {
        updateData.firstName = firstName.trim();
      } else {
        updateData.firstName = firstName || null;
      }
    }
    
    if (lastName !== undefined) {
      if (typeof lastName === 'string' && lastName.trim()) {
        updateData.lastName = lastName.trim();
      } else {
        updateData.lastName = lastName || null;
      }
    }
    
    // Update name if both firstName and lastName are provided
    if (firstName !== undefined && lastName !== undefined) {
      const first = typeof firstName === 'string' ? firstName.trim() : firstName || '';
      const last = typeof lastName === 'string' ? lastName.trim() : lastName || '';
      if (first && last) {
        updateData.name = `${first} ${last}`;
      } else if (first || last) {
        updateData.name = first || last;
      }
    }
    
    // Add other fields
    const finalUpdateData = {
      ...updateData,
      ...(gender && { gender }),
      ...(clubId !== undefined && clubId && clubId.trim() !== '' && { clubId: clubId.trim() }),
      ...(email !== undefined && { email: email?.trim() || null }),
      ...(phone !== undefined && {
        phone: formattedPhone,
      }),
      ...(city !== undefined && { city: city?.trim() || null }),
      ...(region !== undefined && { region: region?.trim() || null }),
      ...(country && { country: country.trim() }),
      ...(dupr !== undefined && { dupr: dupr ? parseFloat(dupr) : null }),
      ...(birthday !== undefined && {
        birthdayYear,
        birthdayMonth,
        birthdayDay,
        birthday: birthdayDate
      })
    };
    
    const updatedPlayer = await prisma.player.update({
      where: { clerkUserId: userId },
      data: finalUpdateData,
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
      phone: formatPhoneForDisplay(updatedPlayer.phone),
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
  } catch (error: any) {
    console.error('Error updating user profile:', error);
    console.error('Error details:', {
      message: error?.message,
      code: error?.code,
      meta: error?.meta,
      stack: error?.stack
    });
    
    // Return more detailed error information in development
    const errorMessage = process.env.NODE_ENV === 'development' 
      ? error?.message || 'Failed to update user profile'
      : 'Failed to update user profile';
    
    return NextResponse.json(
      { 
        error: errorMessage,
        details: process.env.NODE_ENV === 'development' ? error?.message : undefined
      },
      { status: 500 }
    );
  }
}

