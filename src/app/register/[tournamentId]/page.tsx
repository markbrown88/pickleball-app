import { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { auth } from '@clerk/nextjs/server';
import { cookies } from 'next/headers';
import { prisma } from '@/lib/prisma';
import { TournamentRegistrationFlow } from './TournamentRegistrationFlow';
import { getEffectivePlayer } from '@/lib/actAs';

type PageProps = {
  params: Promise<{ tournamentId: string }>;
};

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { tournamentId } = await params;

  const tournament = await prisma.tournament.findUnique({
    where: { id: tournamentId },
    select: { name: true },
  });

  if (!tournament) {
    return {
      title: 'Tournament Not Found',
    };
  }

  return {
    title: `Register for ${tournament.name}`,
    description: `Register for the ${tournament.name} pickleball tournament`,
  };
}

export default async function RegisterPage({ params }: PageProps) {
  const { tournamentId } = await params;
  const { userId } = await auth();

  // Fetch player info if logged in (support Act As)
  let initialPlayerInfo: {
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
  } | null = null;

  if (userId) {
    // Check for Act As cookie
    const cookieStore = await cookies();
    const actAsPlayerId = cookieStore.get('act-as-player-id')?.value;
    
    let effectivePlayerId: string | null = null;
    
    try {
      const effectivePlayer = await getEffectivePlayer(actAsPlayerId || null);
      effectivePlayerId = effectivePlayer.targetPlayerId;
    } catch (actAsError) {
      // If Act As fails, use real player
      const realPlayer = await prisma.player.findUnique({
        where: { clerkUserId: userId },
        select: { id: true }
      });
      effectivePlayerId = realPlayer?.id || null;
    }

    if (effectivePlayerId) {
      const player = await prisma.player.findUnique({
        where: { id: effectivePlayerId },
        select: {
          firstName: true,
          lastName: true,
          email: true,
          phone: true,
        },
      });

      if (player) {
        initialPlayerInfo = {
          firstName: player.firstName || '',
          lastName: player.lastName || '',
          email: player.email || '',
          phone: player.phone || '',
        };
      }
    }
  }

  // Fetch tournament data
  const tournament = await prisma.tournament.findUnique({
    where: { id: tournamentId },
    include: {
      stops: {
        orderBy: { startAt: 'asc' },
        select: {
          id: true,
          name: true,
          startAt: true,
          endAt: true,
        },
      },
      brackets: {
        orderBy: { idx: 'asc' },
        where: {
          NOT: {
            name: 'DEFAULT',
          },
        },
        select: {
          id: true,
          name: true,
          idx: true,
        },
      },
      clubs: {
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
      },
    },
  });

  if (!tournament) {
    notFound();
  }

  // Check if registration is open
  if (tournament.registrationStatus === 'CLOSED') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface-1">
        <div className="max-w-md w-full p-8 bg-surface-2 border border-border-subtle rounded-lg text-center">
          <svg
            className="w-16 h-16 mx-auto mb-4 text-error"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
            />
          </svg>
          <h1 className="text-2xl font-bold text-primary mb-2">
            Registration Closed
          </h1>
          <p className="text-muted mb-6">
            Registration for {tournament.name} is currently closed.
          </p>
          <a href="/" className="btn btn-primary">
            Return Home
          </a>
        </div>
      </div>
    );
  }

  // Check if registration is invite-only
  if (tournament.registrationStatus === 'INVITE_ONLY') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface-1">
        <div className="max-w-md w-full p-8 bg-surface-2 border border-border-subtle rounded-lg text-center">
          <svg
            className="w-16 h-16 mx-auto mb-4 text-warning"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
            />
          </svg>
          <h1 className="text-2xl font-bold text-primary mb-2">
            Invite Only
          </h1>
          <p className="text-muted mb-6">
            {tournament.name} is invite-only. Please contact the tournament organizer for an invitation.
          </p>
          <a href="/" className="btn btn-primary">
            Return Home
          </a>
        </div>
      </div>
    );
  }

  // Filter out past stops (where endAt is in the past)
  const now = new Date();
  const futureStops = tournament.stops.filter((stop) => {
    // If stop has an endAt date, check if it's in the future
    if (stop.endAt) {
      return new Date(stop.endAt) >= now;
    }
    // If no endAt, check startAt (if it exists)
    if (stop.startAt) {
      return new Date(stop.startAt) >= now;
    }
    // If no dates at all, include it (shouldn't happen but be safe)
    return true;
  });

  // Prepare tournament data for client component
  const tournamentData = {
    id: tournament.id,
    name: tournament.name,
    type: tournament.type,
    registrationType: tournament.registrationType,
    registrationCost: tournament.registrationCost,
    pricingModel: tournament.pricingModel,
    maxPlayers: tournament.maxPlayers,
    restrictionNotes: tournament.restrictionNotes ?? [],
    stops: futureStops.map((stop) => ({
      id: stop.id,
      name: stop.name,
      startAt: stop.startAt?.toISOString() ?? null,
      endAt: stop.endAt?.toISOString() ?? null,
      registrationDeadline: null, // Field doesn't exist in schema yet
      isRegistrationClosed: false, // Field doesn't exist in schema yet
    })),
    brackets: tournament.brackets,
    clubs: tournament.clubs.map((tc) => ({
      id: tc.club.id,
      name: tc.club.name,
      city: tc.club.city,
      region: tc.club.region,
    })),
  };

  return <TournamentRegistrationFlow tournament={tournamentData} initialPlayerInfo={initialPlayerInfo} />;
}
