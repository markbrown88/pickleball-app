import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';

import { prisma } from '@/lib/prisma';
import { getEffectivePlayer, getActAsHeaderFromRequest } from '@/lib/actAs';

type PlayerLite = {
  id: string;
  firstName: string | null;
  lastName: string | null;
  name: string | null;
  gender: 'MALE' | 'FEMALE';
  dupr: number | null; // Using duprDoubles, kept as 'dupr' for backward compatibility
  age: number | null;
  hasPaid: boolean;
  paymentMethod: 'STRIPE' | 'MANUAL' | 'UNPAID';
};

type StopData = {
  stopId: string;
  stopName: string;
  locationName: string | null;
  startAt: string | null;
  endAt: string | null;
};

type BracketRoster = {
  teamId: string;
  bracketName: string | null;
  roster: PlayerLite[];
  stops: Array<{
    stopId: string;
    stopRoster: PlayerLite[];
  }>;
};

type ClubRoster = {
  clubId: string;
  clubName: string;
  captainAccessToken: string | null;
  isManagedByUser: boolean;
  canEdit: boolean;
  brackets: BracketRoster[];
};

type TournamentRosterPayload = {
  tournamentId: string;
  tournamentName: string;
  maxTeamSize: number | null;
  stops: StopData[];
  clubs: ClubRoster[];
};

function toPlayerLite(
  player: any,
  stopId: string,
  paidStopPlayerMap: Map<string, Set<string>>,
  paymentMethodOverride?: 'STRIPE' | 'MANUAL' | 'UNPAID'
): PlayerLite {
  const paidPlayersForStop = paidStopPlayerMap.get(stopId) ?? new Set<string>();
  const paidViaStripe = paidPlayersForStop.has(player.id);

  // Determine payment method
  let paymentMethod: 'STRIPE' | 'MANUAL' | 'UNPAID';
  if (paymentMethodOverride) {
    // Use override from StopTeamPlayer if provided
    paymentMethod = paymentMethodOverride;
  } else if (paidViaStripe) {
    // Check if paid via Stripe
    paymentMethod = 'STRIPE';
  } else {
    // Default to unpaid
    paymentMethod = 'UNPAID';
  }

  return {
    id: player.id,
    firstName: player.firstName ?? null,
    lastName: player.lastName ?? null,
    name: player.name ?? null,
    gender: player.gender,
    dupr: player.duprDoubles ?? player.duprSingles ?? null, // Prefer duprDoubles, fallback to duprSingles
    age: player.age ?? null,
    hasPaid: paymentMethod === 'STRIPE' || paymentMethod === 'MANUAL',
    paymentMethod,
  };
}

function toDateStr(d?: Date | null): string | null {
  if (!d) return null;
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export async function GET(
  request: Request,
  ctx: { params: Promise<{ tournamentId: string }> }
) {
  try {
    const { tournamentId } = await ctx.params;

    // Support Act As functionality
    const actAsPlayerId = getActAsHeaderFromRequest(request);
    const effectivePlayer = await getEffectivePlayer(actAsPlayerId);

    const player = await prisma.player.findUnique({
      where: { id: effectivePlayer.targetPlayerId },
      select: {
        id: true,
        isAppAdmin: true,
        tournamentAdminLinks: { where: { tournamentId }, select: { tournamentId: true } },
        TournamentCaptain: { where: { tournamentId }, select: { tournamentId: true, clubId: true } },
      },
    });

    if (!player) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const isAppAdmin = player.isAppAdmin;
    const isTournamentAdmin = player.tournamentAdminLinks.length > 0;
    const isCaptain = player.TournamentCaptain.length > 0;
    const captainClubIds = new Set(player.TournamentCaptain.map((c) => c.clubId));

    if (!isAppAdmin && !isTournamentAdmin && !isCaptain) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const tournament = await prisma.tournament.findUnique({
      where: { id: tournamentId },
      select: {
        id: true,
        name: true,
        maxTeamSize: true,
        clubs: {
          select: {
            clubId: true,
            captainAccessToken: true,
            club: { select: { name: true } },
          },
        },
        stops: {
          select: {
            id: true,
            name: true,
            startAt: true,
            endAt: true,
            club: { select: { name: true } },
          },
          orderBy: { startAt: 'asc' },
        },
      },
    });

    if (!tournament) {
      return NextResponse.json({ error: 'Tournament not found' }, { status: 404 });
    }

    // Fetch all paid registrations for this tournament with stop information
    const paidRegistrations = await prisma.tournamentRegistration.findMany({
      where: {
        tournamentId,
        paymentStatus: { in: ['PAID', 'COMPLETED'] },
      },
      select: { playerId: true, notes: true },
    });

    // Build map of stopId -> Set of playerIds who paid for that stop
    const paidStopPlayerMap = new Map<string, Set<string>>();
    for (const reg of paidRegistrations) {
      try {
        const notes = reg.notes ? JSON.parse(reg.notes) : {};
        const stopIds: string[] = notes.stopIds ?? [];
        for (const stopId of stopIds) {
          if (!paidStopPlayerMap.has(stopId)) {
            paidStopPlayerMap.set(stopId, new Set<string>());
          }
          paidStopPlayerMap.get(stopId)!.add(reg.playerId);
        }
      } catch (err) {
        // If notes parsing fails, skip this registration
        console.error(`Failed to parse notes for registration ${reg.playerId}:`, err);
      }
    }

    if (!tournament.clubs.length) {
      // For tournaments without clubs linked, we still need to fetch teams
      // and group them by their clubId
      const tournamentStopIds = tournament.stops.map((stop) => stop.id);

      const allTeams = await prisma.team.findMany({
        where: { tournamentId },
        select: {
          id: true,
          name: true,
          bracket: { select: { id: true, name: true } },
          clubId: true,
          club: { select: { id: true, name: true } },
          playerLinks: {
            select: { player: true },
            orderBy: { createdAt: 'asc' },
          },
        },
        orderBy: [{ bracket: { idx: 'asc' } }, { name: 'asc' }],
      });

      if (allTeams.length === 0) {
        return NextResponse.json({
          tournamentId,
          tournamentName: tournament.name,
          maxTeamSize: tournament.maxTeamSize ?? null,
          stops: tournament.stops.map((stop) => ({
            stopId: stop.id,
            stopName: stop.name,
            locationName: stop.club?.name ?? null,
            startAt: toDateStr(stop.startAt),
            endAt: toDateStr(stop.endAt ?? stop.startAt),
          })),
          clubs: [] as ClubRoster[],
        } satisfies TournamentRosterPayload);
      }

      const stopTeamPlayers = await prisma.stopTeamPlayer.findMany({
        where: { stopId: { in: tournamentStopIds }, teamId: { in: allTeams.map((t) => t.id) } },
        select: {
          stopId: true,
          teamId: true,
          paymentMethod: true,
          player: true,
        },
        orderBy: [{ stopId: 'asc' }, { createdAt: 'asc' }],
      });

      const stopRosterMap = new Map<string, PlayerLite[]>();
      for (const entry of stopTeamPlayers) {
        const key = `${entry.teamId}:${entry.stopId}`;
        const current = stopRosterMap.get(key) ?? [];
        current.push(toPlayerLite(entry.player, entry.stopId, paidStopPlayerMap, entry.paymentMethod));
        stopRosterMap.set(key, current);
      }

      // Group teams by clubId
      const clubsMap = new Map<string, { clubId: string; clubName: string; teams: typeof allTeams }>();
      for (const team of allTeams) {
        if (!team.clubId) continue; // Skip teams without clubId
        
        const clubId = team.clubId;
        const clubName = team.club?.name ?? 'Unknown Club';
        
        if (!clubsMap.has(clubId)) {
          clubsMap.set(clubId, { clubId, clubName, teams: [] });
        }
        clubsMap.get(clubId)!.teams.push(team);
      }

      // Filter and sort clubs based on user role
      let allowedClubs = Array.from(clubsMap.values());

      // Captains see all clubs, but their clubs come first
      if (isCaptain && !isAppAdmin && !isTournamentAdmin) {
        allowedClubs = allowedClubs.slice().sort((a, b) => {
          const aIsCaptainClub = captainClubIds.has(a.clubId);
          const bIsCaptainClub = captainClubIds.has(b.clubId);
          if (aIsCaptainClub && !bIsCaptainClub) return -1;
          if (!aIsCaptainClub && bIsCaptainClub) return 1;
          return 0;
        });
      }

      const clubs: ClubRoster[] = allowedClubs.map((club) => {
        const brackets: BracketRoster[] = club.teams.map((team) => ({
          teamId: team.id,
          bracketName: team.bracket?.name ?? null,
          roster: team.playerLinks.map((link) => toPlayerLite(link.player, '', paidStopPlayerMap)),
          stops: tournament.stops.map((stop) => ({
            stopId: stop.id,
            stopRoster: stopRosterMap.get(`${team.id}:${stop.id}`) ?? [],
          })),
        }));

        return {
          clubId: club.clubId,
          clubName: club.clubName,
          captainAccessToken: null, // No TournamentClub link, so no access token
          isManagedByUser: captainClubIds.has(club.clubId) || isAppAdmin || isTournamentAdmin,
          canEdit: isAppAdmin || isTournamentAdmin, // Captains can view but not edit
          brackets,
        };
      });

      return NextResponse.json({
        tournamentId,
        tournamentName: tournament.name,
        maxTeamSize: tournament.maxTeamSize ?? null,
        stops: tournament.stops.map((stop) => ({
          stopId: stop.id,
          stopName: stop.name,
          locationName: stop.club?.name ?? null,
          startAt: toDateStr(stop.startAt),
          endAt: toDateStr(stop.endAt ?? stop.startAt),
        })),
        clubs,
      } satisfies TournamentRosterPayload);
    }

    const tournamentStopIds = tournament.stops.map((stop) => stop.id);

    const teams = await prisma.team.findMany({
      where: { tournamentId, clubId: { in: tournament.clubs.map((c) => c.clubId) } },
      select: {
        id: true,
        name: true,
        bracket: { select: { id: true, name: true } },
        clubId: true,
        playerLinks: {
          select: { player: true },
          orderBy: { createdAt: 'asc' },
        },
      },
      orderBy: [{ bracket: { idx: 'asc' } }, { name: 'asc' }],
    });

    const stopTeamPlayers = await prisma.stopTeamPlayer.findMany({
      where: { stopId: { in: tournamentStopIds }, teamId: { in: teams.map((t) => t.id) } },
      select: {
        stopId: true,
        teamId: true,
        paymentMethod: true,
        player: true,
      },
      orderBy: [{ stopId: 'asc' }, { createdAt: 'asc' }],
    });

    const stopRosterMap = new Map<string, PlayerLite[]>();
    for (const entry of stopTeamPlayers) {
      const key = `${entry.teamId}:${entry.stopId}`;
      const current = stopRosterMap.get(key) ?? [];
      current.push(toPlayerLite(entry.player, entry.stopId, paidStopPlayerMap, entry.paymentMethod));
      stopRosterMap.set(key, current);
    }

    // Filter and sort clubs based on user role
    let allowedClubs = tournament.clubs;

    // Captains see all clubs, but their clubs come first
    if (isCaptain && !isAppAdmin && !isTournamentAdmin) {
      allowedClubs = tournament.clubs.slice().sort((a, b) => {
        const aIsCaptainClub = captainClubIds.has(a.clubId);
        const bIsCaptainClub = captainClubIds.has(b.clubId);
        if (aIsCaptainClub && !bIsCaptainClub) return -1;
        if (!aIsCaptainClub && bIsCaptainClub) return 1;
        return 0;
      });
    }

    const clubs: ClubRoster[] = allowedClubs.map((link) => {
      const clubTeams = teams.filter((team) => team.clubId === link.clubId);

      const brackets: BracketRoster[] = clubTeams.map((team) => ({
        teamId: team.id,
        bracketName: team.bracket?.name ?? null,
        roster: team.playerLinks.map((link) => toPlayerLite(link.player, '', paidStopPlayerMap)),
        stops: tournament.stops.map((stop) => ({
          stopId: stop.id,
          stopRoster: stopRosterMap.get(`${team.id}:${stop.id}`) ?? [],
        })),
      }));

      return {
        clubId: link.clubId,
        clubName: link.club?.name ?? 'Club',
        captainAccessToken: link.captainAccessToken ?? null,
        isManagedByUser: captainClubIds.has(link.clubId) || isAppAdmin || isTournamentAdmin,
        canEdit: isAppAdmin || isTournamentAdmin, // Captains can view but not edit
        brackets,
      };
    });

    const payload: TournamentRosterPayload = {
      tournamentId,
      tournamentName: tournament.name,
      maxTeamSize: tournament.maxTeamSize ?? null,
      stops: tournament.stops.map((stop) => ({
        stopId: stop.id,
        stopName: stop.name,
        locationName: stop.club?.name ?? null,
        startAt: toDateStr(stop.startAt),
        endAt: toDateStr(stop.endAt ?? stop.startAt),
      })),
      clubs,
    };

    return NextResponse.json(payload);
  } catch (e: any) {
    console.error('[Rosters API] Error loading roster data:', e);
    const message = e?.message ?? 'Failed to load roster data';
    return NextResponse.json({ 
      error: message,
      details: process.env.NODE_ENV === 'development' ? String(e) : undefined
    }, { status: 500 });
  }
}

