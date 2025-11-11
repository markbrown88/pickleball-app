import { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { stripe } from '@/lib/stripe/config';

type PageProps = {
  params: Promise<{ tournamentId: string }>;
  searchParams: Promise<{ session_id?: string }>;
};

export const metadata: Metadata = {
  title: 'Payment Successful',
  description: 'Your tournament registration payment was successful',
};

export default async function PaymentSuccessPage({ params, searchParams }: PageProps) {
  const { tournamentId } = await params;
  const { session_id: sessionId } = await searchParams;

  if (!sessionId) {
    notFound();
  }

  try {
    // Retrieve the checkout session from Stripe
    const session = await stripe.checkout.sessions.retrieve(sessionId);

    if (!session) {
      notFound();
    }

    // Get registration ID from session metadata
    const registrationId = session.metadata?.registrationId || session.client_reference_id;

    if (!registrationId) {
      notFound();
    }

    // Fetch registration details
    const registration = await prisma.tournamentRegistration.findUnique({
      where: { id: registrationId },
      include: {
        tournament: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    if (!registration || registration.tournamentId !== tournamentId) {
      notFound();
    }

    // If payment is confirmed, redirect to confirmation page
    if (session.payment_status === 'paid') {
      redirect(`/register/${tournamentId}/confirmation?registrationId=${registrationId}`);
    }

    // Otherwise redirect to payment status page
    redirect(`/register/${tournamentId}/payment/status/${registrationId}`);

  } catch (error) {
    console.error('Error retrieving payment session:', error);
    notFound();
  }
}
