import { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/prisma';
import { formatAmountFromStripe } from '@/lib/stripe/helpers';
import { PaymentAnalyticsClient } from './PaymentAnalyticsClient';

type PageProps = {};

export const metadata: Metadata = {
  title: 'Payment Analytics',
  description: 'View payment analytics and statistics',
};

export default async function PaymentAnalyticsPage({}: PageProps) {
  const { userId } = await auth();

  if (!userId) {
    redirect('/sign-in');
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
    redirect('/dashboard');
  }

  // Fetch payment statistics
  const [
    totalRevenue,
    totalRegistrations,
    paidRegistrations,
    pendingRegistrations,
    failedRegistrations,
    refundedRegistrations,
    revenueByTournament,
    recentPayments,
    allPendingPayments,
  ] = await Promise.all([
    // Total revenue (sum of all paid amounts)
    prisma.tournamentRegistration.aggregate({
      where: {
        paymentStatus: 'PAID',
      },
      _sum: {
        amountPaid: true,
      },
    }),

    // Total registrations count
    prisma.tournamentRegistration.count(),

    // Paid registrations count
    prisma.tournamentRegistration.count({
      where: {
        paymentStatus: 'PAID',
      },
    }),

    // Pending registrations count
    prisma.tournamentRegistration.count({
      where: {
        paymentStatus: 'PENDING',
      },
    }),

    // Failed registrations count
    prisma.tournamentRegistration.count({
      where: {
        paymentStatus: 'FAILED',
      },
    }),

    // Refunded registrations count
    prisma.tournamentRegistration.count({
      where: {
        paymentStatus: 'REFUNDED',
      },
    }),

    // Revenue by tournament
    prisma.tournamentRegistration.groupBy({
      by: ['tournamentId'],
      where: {
        paymentStatus: 'PAID',
      },
      _sum: {
        amountPaid: true,
      },
      _count: {
        id: true,
      },
    }),

    // Recent payments (last 50)
    prisma.tournamentRegistration.findMany({
      where: {
        paymentStatus: { in: ['PAID', 'PENDING', 'FAILED', 'REFUNDED'] },
      },
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
      take: 50,
    }),

    // All pending payments (always include these)
    prisma.tournamentRegistration.findMany({
      where: {
        paymentStatus: 'PENDING',
      },
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
    }),
  ]);

  // Combine recent payments with all pending payments, removing duplicates
  const recentPaymentIds = new Set(recentPayments.map(p => p.id));
  const additionalPendingPayments = allPendingPayments.filter(p => !recentPaymentIds.has(p.id));
  const combinedPayments = [...recentPayments, ...additionalPendingPayments];

  // Get tournament names for revenue breakdown
  const tournamentIds = revenueByTournament.map((r) => r.tournamentId);
  const tournaments = await prisma.tournament.findMany({
    where: {
      id: { in: tournamentIds },
    },
    select: {
      id: true,
      name: true,
    },
  });

  const tournamentMap = new Map(tournaments.map((t) => [t.id, t.name]));

  const revenueBreakdown = revenueByTournament
    .map((r) => ({
      tournamentId: r.tournamentId,
      tournamentName: tournamentMap.get(r.tournamentId) || 'Unknown Tournament',
      revenue: r._sum.amountPaid || 0,
      count: r._count.id,
    }))
    .sort((a, b) => b.revenue - a.revenue);

  const stats = {
    totalRevenue: totalRevenue._sum.amountPaid || 0,
    totalRegistrations,
    paidRegistrations,
    pendingRegistrations,
    failedRegistrations,
    refundedRegistrations,
    successRate: totalRegistrations > 0 
      ? ((paidRegistrations / totalRegistrations) * 100).toFixed(1)
      : '0',
  };

  return (
    <PaymentAnalyticsClient
      stats={stats}
      revenueBreakdown={revenueBreakdown}
      recentPayments={combinedPayments.map((p) => ({
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
      }))}
    />
  );
}

