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

  // Get Stripe session ID from notes if available
  let stripeSessionId: string | null = null;
  let paymentIntentId: string | null = registration.paymentId || null;

  if (registration.notes) {
    try {
      const notes = JSON.parse(registration.notes);
      stripeSessionId = notes.stripeSessionId || null;
      paymentIntentId = paymentIntentId || notes.paymentIntentId || null;
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
    />
  );
}
