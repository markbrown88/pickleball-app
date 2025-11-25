import { headers } from 'next/headers';
import { notFound } from 'next/navigation';
import dynamic from 'next/dynamic';
import type { MatchTiebreakerStatus } from '@prisma/client';

// Dynamically import TournamentClient to reduce initial bundle size
const TournamentClient = dynamic(() => import('./TournamentClient'), {
  loading: () => (
    <div className="min-h-screen bg-app flex items-center justify-center">
      <div className="flex items-center gap-3">
        <div className="loading-spinner" />
        <span className="text-muted">Loading tournament...</span>
      </div>
    </div>
  )
});

interface Tournament {
  id: string;
  name: string;
  description?: string;
  startDate?: string;
  endDate?: string;
  type?: string;
  stops?: any[];
}

interface Stop {
  id: string;
  name: string;
  tournamentId: string;
  rounds: Round[];
  startAt?: string | null;
  endAt?: string | null;
}

interface Round {
  id: string;
  name: string;
  stopId: string;
  matches: Match[];
}

interface Match {
  id: string;
  teamA: Team;
  teamB: Team;
  games: Game[];
  status: string;
  forfeitTeam?: string | null;
  tiebreakerStatus?: MatchTiebreakerStatus;
  tiebreakerWinnerTeamId?: string | null;
  totalPointsTeamA?: number | null;
  totalPointsTeamB?: number | null;
}

interface Team {
  id: string;
  name: string;
  club?: {
    name: string;
  };
  bracket?: {
    name: string;
  };
}

interface Game {
  id: string;
  slot: string;
  teamAScore: number | null;
  teamBScore: number | null;
  isComplete: boolean | null;
  courtNumber?: string | null;
  lineupConfirmed?: boolean;
  teamALineup?: Player[];
  teamBLineup?: Player[];
  startedAt?: string | null;
  endedAt?: string | null;
  updatedAt?: string | null;
  createdAt?: string | null;
}

interface Player {
  id: string;
  name: string;
  firstName?: string | null;
  lastName?: string | null;
  gender?: string | null;
}

async function resolveBaseUrl() {
  const headerList = await headers();
  const host = headerList.get('x-forwarded-host') ?? headerList.get('host');
  const protocol = headerList.get('x-forwarded-proto') ?? 'http';

  if (host) {
    return `${protocol}://${host}`;
  }

  if (process.env.NEXT_PUBLIC_APP_URL) {
    return process.env.NEXT_PUBLIC_APP_URL;
  }

  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`;
  }

  throw new Error('Unable to resolve application URL');
}

async function getTournament(baseUrl: string, tournamentId: string): Promise<Tournament | null> {
  try {
    const response = await fetch(`${baseUrl}/api/tournaments`, {
      cache: 'no-store'
    });
    
    if (!response.ok) {
      return null;
    }
    
    const data = await response.json();
    const tournaments = data.tournaments || [];
    return tournaments.find((t: any) => t.id === tournamentId) || null;
  } catch (error) {
    console.error('Error fetching tournament:', error);
    return null;
  }
}

async function getStops(tournament: Tournament): Promise<Stop[]> {
  // Use stops data from the tournament object instead of admin API
  if (tournament.stops && Array.isArray(tournament.stops)) {
    return tournament.stops.map((stop: any) => ({
      id: stop.id,
      name: stop.name,
      tournamentId: tournament.id,
      rounds: [],
      startAt: stop.startAt ?? null,
      endAt: stop.endAt ?? null
    }));
  }
  return [];
}

async function getStopData(baseUrl: string, stopId: string, stopName: string): Promise<Stop | null> {
  try {
    // Use the public scoreboard API to get rounds, matches, and games data
    const response = await fetch(`${baseUrl}/api/public/stops/${stopId}/scoreboard`, {
      cache: 'no-store'
    });

    if (!response.ok) {
      console.error('Failed to fetch stop scoreboard:', response.status, response.statusText);
      return {
        id: stopId,
        name: stopName,
        tournamentId: '',
        rounds: []
      };
    }

    const data = await response.json();
    
    // Transform the scoreboard data to match our Stop interface
    return {
      id: stopId,
      name: data.stop.name || stopName,
      tournamentId: data.stop.tournamentId || '',
      startAt: data.stop.startAt || null,
      endAt: data.stop.endAt || null,
      rounds: data.rounds.map((round: any) => ({
        id: round.roundId,
        name: `Round ${round.idx + 1}`,
        stopId: stopId,
        matches: round.matches.map((match: any) => ({
          id: match.matchId,
          teamA: match.teamA,
          teamB: match.teamB,
          forfeitTeam: match.forfeitTeam,
          tiebreakerStatus: match.tiebreakerStatus && match.tiebreakerStatus !== 'undefined' ? match.tiebreakerStatus : 'NONE',
          tiebreakerWinnerTeamId: match.tiebreakerWinnerTeamId && match.tiebreakerWinnerTeamId !== 'undefined' ? match.tiebreakerWinnerTeamId : null,
          totalPointsTeamA: match.totalPointsTeamA,
          totalPointsTeamB: match.totalPointsTeamB,
          games: match.games.map((game: any) => {
            const rawIsComplete = typeof game.isComplete === 'boolean' ? game.isComplete : null;
            const isComplete = rawIsComplete === true || Boolean(game.endedAt);

            return {
              id: game.id,
              slot: game.slot,
              teamAScore: game.teamAScore,
              teamBScore: game.teamBScore,
              isComplete,
              startedAt: game.startedAt ?? null,
              endedAt: game.endedAt ?? null,
              updatedAt: game.updatedAt ?? null,
              createdAt: game.createdAt ?? null,
              courtNumber: game.courtNumber ?? null,
              lineupConfirmed: game.lineupConfirmed ?? false,
              teamALineup: game.teamALineup || [],
              teamBLineup: game.teamBLineup || []
            } as Game;
          }),
          status: 'scheduled' // Default status
        }))
      }))
    };
  } catch (error) {
    console.error('Error loading stop data:', error);
    return {
      id: stopId,
      name: stopName,
      tournamentId: '',
      rounds: [],
      startAt: null,
      endAt: null
    };
  }
}

export default async function TournamentPage({ params }: { params: Promise<{ tournamentId: string }> }) {
  const baseUrl = await resolveBaseUrl();
  const { tournamentId } = await params;
  const tournament = await getTournament(baseUrl, tournamentId);

  if (!tournament) {
    notFound();
  }

  const stops = await getStops(tournament);
  
  // Load data for the first stop if available
  let firstStopData = null;
  if (stops.length > 0) {
    firstStopData = await getStopData(baseUrl, stops[0].id, stops[0].name);
  }

  return (
    <TournamentClient 
      tournament={tournament}
      stops={stops}
      initialStopData={firstStopData}
    />
  );
}
