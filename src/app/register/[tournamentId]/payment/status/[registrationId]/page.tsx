import { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { stripe } from '@/lib/stripe/config';
import { PaymentStatusClient } from './PaymentStatusClient';

type PageProps = {
  params: Promise<{ tournamentId: string; registrationId: string }>;
};

export const metadata: Metadata = {
  title: 'Payment Status',
  description: 'Check your tournament registration payment status',
};

export default async function PaymentStatusPage({ params }: PageProps) {
  const { tournamentId, registrationId } = await params;

  // Fetch registration details
  const registration = await prisma.tournamentRegistration.findUnique({
    where: { id: registrationId },
    include: {
      tournament: {
        select: {
          id: true,
          name: true,
          registrationType: true,
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
  });

  if (!registration) {
    notFound();
  }

  // Verify tournament matches
  if (registration.tournamentId !== tournamentId) {
    notFound();
  }

  // Get Stripe session ID and registration details from notes
  let stripeSessionId: string | null = null;
  let paymentIntentId: string | null = registration.paymentId || null;
  let purchaseDetails: {
    stops: Array<{ id: string; name: string }>;
    club: { id: string; name: string } | null;
    brackets: Array<{ stopId: string; bracketId: string; bracketName: string }>;
  } | null = null;

  if (registration.notes) {
    try {
      const notes = JSON.parse(registration.notes);
      stripeSessionId = notes.stripeSessionId || null;
      paymentIntentId = paymentIntentId || notes.paymentIntentId || null;

      // Extract purchase details from notes
      const stopIds = notes.stopIds || [];
      const clubId = notes.clubId || null;
      const brackets = notes.brackets || [];

      // Fetch stop details
      const stops = await prisma.stop.findMany({
        where: { id: { in: stopIds } },
        select: {
          id: true,
          name: true,
          startAt: true,
        },
        orderBy: { startAt: 'asc' },
      });

      // Fetch club details
      let club: { id: string; name: string } | null = null;
      if (clubId) {
        const clubData = await prisma.club.findUnique({
          where: { id: clubId },
          select: { id: true, name: true },
        });
        if (clubData) {
          club = clubData;
        }
      }

      // Fetch bracket details
      const bracketIds = brackets.map((b: any) => b.bracketId).filter(Boolean);
      const bracketData = await prisma.tournamentBracket.findMany({
        where: { id: { in: bracketIds } },
        select: { id: true, name: true },
      });

      // Map brackets with names
      const enrichedBrackets = brackets
        .filter((b: any) => b.bracketId)
        .map((b: any) => {
          const bracket = bracketData.find((bd) => bd.id === b.bracketId);
          return {
            stopId: b.stopId,
            bracketId: b.bracketId,
            bracketName: bracket?.name || 'Unknown Bracket',
          };
        });

      purchaseDetails = {
        stops: stops.map((s) => ({ id: s.id, name: s.name })),
        club,
        brackets: enrichedBrackets,
      };
    } catch (e) {
      console.error('Failed to parse registration notes:', e);
    }
  }

  // Fetch payment details from Stripe if we have a payment intent ID
  let stripePayment: {
    status: string;
    amount: number;
    currency: string;
    created: number;
    receipt_url?: string;
  } | null = null;

  if (paymentIntentId) {
    try {
      const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId, {
        expand: ['charges'],
      });
      stripePayment = {
        status: paymentIntent.status,
        amount: paymentIntent.amount,
        currency: paymentIntent.currency,
        created: paymentIntent.created,
        receipt_url: (paymentIntent as any).charges?.data?.[0]?.receipt_url || undefined,
      };
    } catch (e) {
      console.error('Failed to fetch payment intent from Stripe:', e);
    }
  }

  return (
    <PaymentStatusClient
      registration={registration}
      stripePayment={stripePayment}
      paymentIntentId={paymentIntentId}
      purchaseDetails={purchaseDetails}
    />
  );
}
