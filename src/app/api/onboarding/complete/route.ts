import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/prisma';
import { formatPhoneForStorage } from '@/lib/phone';

/**
 * POST /api/onboarding/complete
 * Complete the onboarding process by saving profile data
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
      birthday,
      phone,
      city,
      region,
      country,
      duprSingles,
      duprDoubles,
      clubRatingSingles,
      clubRatingDoubles,
      interestedInWildcard,
      interestedInCaptain,
    } = body;

    // Validate required fields (birthday is now required)
    if (!firstName || !lastName || !gender || !clubId || !birthday) {
      return NextResponse.json(
        { error: 'firstName, lastName, gender, clubId, and birthday are required' },
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
      select: { id: true, name: true },
    });

    if (!club) {
      return NextResponse.json({ error: 'Club not found' }, { status: 404 });
    }

    // Get player record
    const player = await prisma.player.findUnique({
      where: { clerkUserId: userId },
    });

    if (!player) {
      return NextResponse.json(
        { error: 'Player profile not found' },
        { status: 404 }
      );
    }

    // Parse birthday if provided
    let birthdayYear: number | null = null;
    let birthdayMonth: number | null = null;
    let birthdayDay: number | null = null;
    let birthdayDate: Date | null = null;
    let calculatedAge: number | null = null;

    if (birthday) {
      const date = new Date(birthday);
      if (!isNaN(date.getTime())) {
        birthdayYear = date.getUTCFullYear();
        birthdayMonth = date.getUTCMonth() + 1;
        birthdayDay = date.getUTCDate();
        birthdayDate = date;

        // Calculate age
        const today = new Date();
        let age = today.getUTCFullYear() - birthdayYear;
        const monthDiff = today.getUTCMonth() - (birthdayMonth - 1);
        const dayDiff = today.getUTCDate() - birthdayDay;

        if (monthDiff < 0 || (monthDiff === 0 && dayDiff < 0)) {
          age--;
        }

        calculatedAge = age;
      }
    }

    // Update player profile
    const updatedPlayer = await prisma.player.update({
      where: { clerkUserId: userId },
      data: {
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        name: `${firstName.trim()} ${lastName.trim()}`,
        gender,
        clubId,
        email: email?.trim() || player.email,
        phone: phone ? formatPhoneForStorage(phone) : null,
        city: city?.trim() || null,
        region: region?.trim() || null,
        country: country?.trim() || 'Canada',
        duprSingles: duprSingles ? parseFloat(duprSingles) : null,
        duprDoubles: duprDoubles ? parseFloat(duprDoubles) : null,
        clubRatingSingles: clubRatingSingles ? parseFloat(clubRatingSingles) : null,
        clubRatingDoubles: clubRatingDoubles ? parseFloat(clubRatingDoubles) : null,
        birthdayYear,
        birthdayMonth,
        birthdayDay,
        birthday: birthdayDate,
        age: calculatedAge,
        interestedInWildcard: typeof interestedInWildcard === 'boolean' ? interestedInWildcard : null,
        interestedInCaptain: interestedInCaptain || null,
      },
      include: {
        club: {
          select: {
            id: true,
            name: true,
            city: true,
            region: true,
          },
        },
      },
    });

    return NextResponse.json({
      success: true,
      player: {
        id: updatedPlayer.id,
        firstName: updatedPlayer.firstName,
        lastName: updatedPlayer.lastName,
        email: updatedPlayer.email,
        club: updatedPlayer.club,
      },
    });
  } catch (error: any) {
    console.error('Error completing onboarding:', error);
    return NextResponse.json(
      {
        error: 'Failed to complete onboarding',
        details: process.env.NODE_ENV === 'development' ? error?.message : undefined,
      },
      { status: 500 }
    );
  }
}

