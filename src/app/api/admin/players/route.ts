import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/prisma';
import { hasRole } from '@/lib/roles';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const { userId } = await auth();
    
    if (!userId) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    // Get the player record for the authenticated user
    const currentPlayer = await prisma.player.findUnique({
      where: { clerkUserId: userId },
      select: { id: true, isAppAdmin: true }
    });

    if (!currentPlayer) {
      return NextResponse.json({ error: 'Player not found' }, { status: 404 });
    }

    // Check if user is App Admin
    if (!currentPlayer.isAppAdmin) {
      return NextResponse.json({ error: 'Access denied. App Admin required.' }, { status: 403 });
    }

    const url = new URL(req.url);
    const take = parseInt(url.searchParams.get('take') || '25');
    const skip = parseInt(url.searchParams.get('skip') || '0');
    const sort = url.searchParams.get('sort') || 'lastName:asc';
    const search = url.searchParams.get('search') || '';
    const clubId = url.searchParams.get('clubId') || '';

    // Parse sort parameter and handle computed fields
    const [sortField, sortOrder] = sort.split(':');
    let orderBy: any = {};
    
    // Map computed fields to actual database fields
    if (sortField === 'clubName') {
      orderBy = { club: { name: sortOrder } };
    } else if (sortField === 'age') {
      // For age, sort by birthdayYear (descending for age)
      orderBy = { birthdayYear: sortOrder === 'asc' ? 'desc' : 'asc' };
    } else if (sortField === 'clubId') {
      orderBy = { clubId: sortOrder };
    } else {
      orderBy = { [sortField]: sortOrder };
    }

    // Build where clause for search and club filter
    const where: any = {};
    
    if (search) {
      where.OR = [
        { firstName: { contains: search, mode: 'insensitive' } },
        { lastName: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } }
      ];
    }
    
    if (clubId) {
      where.clubId = clubId;
    }

    const [players, total] = await Promise.all([
      prisma.player.findMany({
        where,
        select: {
          id: true,
          firstName: true,
          lastName: true,
          name: true,
          gender: true,
          email: true,
          phone: true,
          city: true,
          region: true,
          country: true,
          dupr: true,
          birthdayYear: true,
          birthdayMonth: true,
          birthdayDay: true,
          isAppAdmin: true,
          createdAt: true,
          club: {
            select: {
              id: true,
              name: true,
              city: true
            }
          }
        },
        orderBy,
        take,
        skip
      }),
      prisma.player.count({ where })
    ]);

    // Add computed fields for admin page
    const playersWithComputedFields = players.map(player => {
      // Calculate age from birthday
      let age = null;
      if (player.birthdayYear) {
        const currentYear = new Date().getFullYear();
        age = currentYear - player.birthdayYear;
      }

      return {
        ...player,
        age,
        clubName: player.club?.name || null
      };
    });

    return NextResponse.json({
      items: playersWithComputedFields,
      total,
      hasMore: skip + take < total
    });

  } catch (error) {
    console.error('Error fetching players:', error);
    return NextResponse.json(
      { error: 'Failed to fetch players' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth();
    
    if (!userId) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    // Get the player record for the authenticated user
    const currentPlayer = await prisma.player.findUnique({
      where: { clerkUserId: userId },
      select: { id: true, isAppAdmin: true }
    });

    if (!currentPlayer) {
      return NextResponse.json({ error: 'Player not found' }, { status: 404 });
    }

    // Check if user is App Admin
    if (!currentPlayer.isAppAdmin) {
      return NextResponse.json({ error: 'Access denied. App Admin required.' }, { status: 403 });
    }

    const body = await req.json();
    const { playerId, isAppAdmin } = body;

    if (!playerId || typeof isAppAdmin !== 'boolean') {
      return NextResponse.json({ error: 'playerId and isAppAdmin required' }, { status: 400 });
    }

    // Update the player's App Admin status
    const updatedPlayer = await prisma.player.update({
      where: { id: playerId },
      data: { isAppAdmin },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        isAppAdmin: true
      }
    });

    return NextResponse.json(updatedPlayer);

  } catch (error) {
    console.error('Error updating player admin status:', error);
    return NextResponse.json(
      { error: 'Failed to update player admin status' },
      { status: 500 }
    );
  }
}