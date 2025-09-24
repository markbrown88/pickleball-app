import { headers } from 'next/headers';
import { notFound } from 'next/navigation';
import TournamentClient from './TournamentClient';

interface Tournament {
  id: string;
  name: string;
  description?: string;
  startDate?: string;
  endDate?: string;
  stops?: any[];
}

interface Stop {
  id: string;
  name: string;
  tournamentId: string;
  rounds: Round[];
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
  courtNumber?: string;
  teamALineup?: Player[];
  teamBLineup?: Player[];
  startedAt?: string;
  endedAt?: string;
  updatedAt?: string;
  createdAt?: string;
}

interface Player {
  id: string;
  name: string;
}

function resolveBaseUrl() {
  const headerList = headers();
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
      rounds: [] // Will be loaded separately if needed
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
      rounds: data.rounds.map((round: any) => ({
        id: round.roundId,
        name: `Round ${round.idx + 1}`,
        stopId: stopId,
        matches: round.matches.map((match: any) => ({
          id: match.matchId,
          teamA: match.teamA,
          teamB: match.teamB,
          games: match.games.map((game: any) => ({
            id: game.id,
            slot: game.slot,
            teamAScore: game.teamAScore,
            teamBScore: game.teamBScore,
            isComplete: game.teamAScore !== null && game.teamBScore !== null,
            startedAt: null, // Not available in scoreboard API
            endedAt: null, // Not available in scoreboard API
            courtNumber: null, // Not available in scoreboard API
            teamALineup: game.teamALineup || [], // Now available from scoreboard API
            teamBLineup: game.teamBLineup || [] // Now available from scoreboard API
          })),
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
      rounds: []
    };
  }
}

export default async function TournamentPage({ params }: { params: { tournamentId: string } }) {
  const baseUrl = resolveBaseUrl();
  const tournament = await getTournament(baseUrl, params.tournamentId);

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
