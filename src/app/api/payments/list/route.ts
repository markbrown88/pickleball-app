import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/prisma';
import { PaymentStatus, Prisma } from '@prisma/client';

export async function GET(request: NextRequest) {
  const { userId } = await auth();

  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Check if user is App Admin
  const player = await prisma.player.findUnique({
    where: { clerkUserId: userId },
    select: {
      id: true,
      isAppAdmin: true,
    },
  });

  if (!player || !player.isAppAdmin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const searchParams = request.nextUrl.searchParams;
  const page = parseInt(searchParams.get('page') || '1', 10);
  const limit = parseInt(searchParams.get('limit') || '25', 10);
  const search = searchParams.get('search') || '';
  const status = searchParams.get('status') || 'ALL';

  const skip = (page - 1) * limit;

  // Build where clause
  const whereClause: Prisma.TournamentRegistrationWhereInput = {};

  // Status filter
  if (status === 'ALL') {
    whereClause.paymentStatus = {
      in: [PaymentStatus.PAID, PaymentStatus.PENDING, PaymentStatus.FAILED, PaymentStatus.REFUNDED]
    };
  } else {
    whereClause.paymentStatus = status as PaymentStatus;
  }

  // Search filter (name, email, or tournament name)
  if (search.trim()) {
    whereClause.OR = [
      {
        player: {
          OR: [
            { firstName: { contains: search, mode: 'insensitive' } },
            { lastName: { contains: search, mode: 'insensitive' } },
            { name: { contains: search, mode: 'insensitive' } },
            { email: { contains: search, mode: 'insensitive' } },
          ],
        },
      },
      {
        tournament: {
          name: { contains: search, mode: 'insensitive' },
        },
      },
    ];
  }

  // Fetch payments with pagination
  const [payments, totalCount] = await Promise.all([
    prisma.tournamentRegistration.findMany({
      where: whereClause,
      include: {
        tournament: {
          select: {
            id: true,
            name: true,
          },
        },
        player: {
          select: {
            firstName: true,
            lastName: true,
            name: true,
            email: true,
          },
        },
      },
      orderBy: {
        registeredAt: 'desc',
      },
      skip,
      take: limit,
    }),
    prisma.tournamentRegistration.count({
      where: whereClause,
    }),
  ]);

  const totalPages = Math.ceil(totalCount / limit);

  return NextResponse.json({
    payments: payments.map((p) => ({
      id: p.id,
      tournamentId: p.tournamentId,
      tournamentName: p.tournament.name,
      playerName:
        p.player.name ||
        (p.player.firstName && p.player.lastName
          ? `${p.player.firstName} ${p.player.lastName}`
          : p.player.firstName || 'Unknown'),
      playerEmail: p.player.email || '',
      amount: p.amountPaid || 0,
      paymentStatus: p.paymentStatus,
      registeredAt: p.registeredAt.toISOString(),
      paymentId: p.paymentId,
    })),
    pagination: {
      page,
      limit,
      totalCount,
      totalPages,
      hasNextPage: page < totalPages,
      hasPrevPage: page > 1,
    },
  });
}
