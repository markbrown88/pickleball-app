// src/app/api/public/tournaments/[tournamentId]/standings/route.ts
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCached, cacheKeys, CACHE_TTL } from '@/lib/cache';

type Params = { tournamentId: string };

export async function GET(_req: Request, ctx: { params: Promise<Params> }) {
  try {
    const { tournamentId } = await ctx.params;
    console.log('Public API: Fetching standings for tournament:', tournamentId);
    
    // Cache standings data (5 minute TTL for public viewing)
    const standings = await getCached(
      cacheKeys.tournamentStandings(tournamentId),
      async () => {
        // Calculate standings from existing tables
        const teams = await prisma.team.findMany({
          where: { tournamentId },
          include: {
            club: true,
            bracket: {
              select: {
                name: true
              }
            },
            matchesA: {
              include: {
                games: true
              }
            },
            matchesB: {
              include: {
                games: true
              }
            }
          }
        });

        const standings = teams.map(team => {
          // Combine all matches (both as teamA and teamB)
          const allMatches = [...team.matchesA, ...team.matchesB];
          
          // Filter out bye matches
          const realMatches = allMatches.filter(match => !match.isBye);
          
          let wins = 0;
          let losses = 0;
          let points = 0;
          
          realMatches.forEach(match => {
            let winner: 'A' | 'B' | null = null;
            let isForfeit = false;

            if (match.forfeitTeam) {
              isForfeit = true;
              winner = match.forfeitTeam === 'A' ? 'B' : 'A';
            } else if (match.tiebreakerWinnerTeamId) {
                winner = match.tiebreakerWinnerTeamId === match.teamAId ? 'A' : 'B';
            }
            else {
              let teamAScore = 0;
              let teamBScore = 0;
              match.games.forEach(game => {
                // Only count completed games
                if (game.isComplete && game.teamAScore != null && game.teamBScore != null) {
                  if (game.teamAScore > game.teamBScore) {
                    teamAScore++;
                  } else if (game.teamBScore > game.teamAScore) {
                    teamBScore++;
                  }
                }
              });
              if (teamAScore > teamBScore) winner = 'A';
              if (teamBScore > teamAScore) winner = 'B';
            }

            if(winner) {
                if( (winner === 'A' && match.teamAId === team.id) || (winner === 'B' && match.teamBId === team.id) ) {
                    wins++;
                    points += 3;
                } else {
                    losses++;
                    points += isForfeit ? 0 : 1;
                }
            }
          });
          
          return {
            team_id: team.id,
            team_name: team.name,
            bracket_name: team.bracket?.name || null,
            clubId: team.clubId,
            clubName: team.club?.name || null,
            tournamentId: team.tournamentId,
            matches_played: realMatches.length,
            wins,
            losses,
            points
          };
        });

        // SPECIAL CASE: Pickleplex Belleville gets 0 points for "KLYNG CUP - pickleplex" tournament
        const KLYNG_CUP_PICKLEPLEX_ID = 'cmh7qeb1t0000ju04udwe7w8w';
        const PICKLEPLEX_BELLEVILLE_CLUB_ID = 'cmfwjxyqn0001rdxtr8v9fmdj';

        const adjustedStandings = standings.map(standing => {
          // If this is the Klyng Cup Pickleplex tournament and the team is from Pickleplex Belleville
          if (
            standing.tournamentId === KLYNG_CUP_PICKLEPLEX_ID &&
            standing.clubId === PICKLEPLEX_BELLEVILLE_CLUB_ID
          ) {
            // Set their points to 0 for standings display
            return {
              ...standing,
              points: 0,
              wins: 0,
              losses: standing.matches_played
            };
          }
          return standing;
        });

        // Sort by points (descending), then by team name (ascending)
        adjustedStandings.sort((a, b) => {
          if (b.points !== a.points) {
            return b.points - a.points;
          }
          return a.team_name.localeCompare(b.team_name);
        });

        console.log('Public API: Calculated standings (with Belleville adjustment):', adjustedStandings);

        return adjustedStandings;
      },
      CACHE_TTL.STANDINGS // 5 minutes
    );
    
    return NextResponse.json(standings);
  } catch (error) {
    console.error('Public API: Error fetching tournament standings:', error);
    return NextResponse.json(
      { error: 'Failed to fetch tournament standings' },
      { status: 500 }
    );
  }
}
