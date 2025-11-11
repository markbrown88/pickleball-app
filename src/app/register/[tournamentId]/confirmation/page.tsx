import { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { ConfirmationStep } from '../components/ConfirmationStep';

type PageProps = {
  params: Promise<{ tournamentId: string }>;
  searchParams: Promise<{ registrationId?: string }>;
};

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { tournamentId } = await params;

  const tournament = await prisma.tournament.findUnique({
    where: { id: tournamentId },
    select: { name: true },
  });

  if (!tournament) {
    return {
      title: 'Registration Confirmation',
    };
  }

  return {
    title: `Registration Confirmed - ${tournament.name}`,
    description: `Your registration for ${tournament.name} has been confirmed`,
  };
}

export default async function ConfirmationPage({ params, searchParams }: PageProps) {
  const { tournamentId } = await params;
  const { registrationId } = await searchParams;

  if (!registrationId) {
    notFound();
  }

  // Fetch registration and tournament data
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

  if (!registration || registration.tournamentId !== tournamentId) {
    notFound();
  }

  const playerName =
    registration.player.name ||
    (registration.player.firstName && registration.player.lastName
      ? `${registration.player.firstName} ${registration.player.lastName}`
      : registration.player.firstName || 'Player');

  return (
    <ConfirmationStep
      tournamentId={registration.tournament.id}
      tournamentName={registration.tournament.name}
      playerName={playerName}
      email={registration.player.email || ''}
      registrationId={registration.id}
      isFree={registration.tournament.registrationType === 'FREE'}
    />
  );
}
