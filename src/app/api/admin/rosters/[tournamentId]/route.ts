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
  dupr: number | null;
  age: number | null;
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
  brackets: BracketRoster[];
};

type TournamentRosterPayload = {
  tournamentId: string;
  tournamentName: string;
  maxTeamSize: number | null;
  stops: StopData[];
  clubs: ClubRoster[];
};

function toPlayerLite(player: any): PlayerLite {
  return {
    id: player.id,
    firstName: player.firstName ?? null,
    lastName: player.lastName ?? null,
    name: player.name ?? null,
    gender: player.gender,
    dupr: player.dupr ?? null,
    age: player.age ?? null,
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
          player: true,
        },
        orderBy: [{ stopId: 'asc' }, { createdAt: 'asc' }],
      });

      const stopRosterMap = new Map<string, PlayerLite[]>();
      for (const entry of stopTeamPlayers) {
        const key = `${entry.teamId}:${entry.stopId}`;
        const current = stopRosterMap.get(key) ?? [];
        current.push(toPlayerLite(entry.player));
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

      // Filter clubs based on user role
      const allowedClubs = Array.from(clubsMap.values()).filter((club) => {
        // App admins and tournament admins see all clubs
        if (isAppAdmin || isTournamentAdmin) return true;
        // Captains only see their clubs
        return captainClubIds.has(club.clubId);
      });

      const clubs: ClubRoster[] = allowedClubs.map((club) => {
        const brackets: BracketRoster[] = club.teams.map((team) => ({
          teamId: team.id,
          bracketName: team.bracket?.name ?? null,
          roster: team.playerLinks.map((link) => toPlayerLite(link.player)),
          stops: tournament.stops.map((stop) => ({
            stopId: stop.id,
            stopRoster: stopRosterMap.get(`${team.id}:${stop.id}`) ?? [],
          })),
        }));

        return {
          clubId: club.clubId,
          clubName: club.clubName,
          captainAccessToken: null, // No TournamentClub link, so no access token
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
        player: true,
      },
      orderBy: [{ stopId: 'asc' }, { createdAt: 'asc' }],
    });

    const stopRosterMap = new Map<string, PlayerLite[]>();
    for (const entry of stopTeamPlayers) {
      const key = `${entry.teamId}:${entry.stopId}`;
      const current = stopRosterMap.get(key) ?? [];
      current.push(toPlayerLite(entry.player));
      stopRosterMap.set(key, current);
    }

    // Filter clubs based on user role
    const allowedClubs = tournament.clubs.filter((link) => {
      // App admins and tournament admins see all clubs
      if (isAppAdmin || isTournamentAdmin) return true;
      // Captains only see their clubs
      return captainClubIds.has(link.clubId);
    });

    const clubs: ClubRoster[] = allowedClubs.map((link) => {
      const clubTeams = teams.filter((team) => team.clubId === link.clubId);

      const brackets: BracketRoster[] = clubTeams.map((team) => ({
        teamId: team.id,
        bracketName: team.bracket?.name ?? null,
        roster: team.playerLinks.map((link) => toPlayerLite(link.player)),
        stops: tournament.stops.map((stop) => ({
          stopId: stop.id,
          stopRoster: stopRosterMap.get(`${team.id}:${stop.id}`) ?? [],
        })),
      }));

      return {
        clubId: link.clubId,
        clubName: link.club?.name ?? 'Club',
        captainAccessToken: link.captainAccessToken ?? null,
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

