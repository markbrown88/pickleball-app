import { NextResponse } from 'next/server';
import { prisma } from '@/server/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function PUT(req: Request, { params }: { params: { teamId: string }}) {
  const { name, clubId } = await req.json();
  await prisma.team.update({
    where: { id: params.teamId },
    data: { name, clubId },
  });
  return NextResponse.json({ ok: true });
}
import { NextResponse } from 'next/server';
import { prisma } from '@/server/db';

async function ensureRosterEligibility(playerId: string, teamId: string) {
  const team = await prisma.team.findUnique({ where: { id: teamId }, select: { tournamentId: true }});
  if (!team?.tournamentId) throw new Error('Team not in tournament');

  const existing = await prisma.teamPlayer.findFirst({
    where: {
      playerId,
      team: { tournamentId: team.tournamentId, NOT: { id: teamId } }
    },
    select: { teamId: true }
  });
  if (existing) throw new Error('Player is already rostered on another team in this tournament');
}

export async function POST(req: Request, { params }: { params: { teamId: string }}) {
  const { playerId } = await req.json();
  try {
    await ensureRosterEligibility(playerId, params.teamId);
    const count = await prisma.teamPlayer.count({ where: { teamId: params.teamId }});
    if (count >= 8) return NextResponse.json({ error: 'Roster is full (max 8)' }, { status: 400 });

    await prisma.teamPlayer.upsert({
      where: { teamId_playerId: { teamId: params.teamId, playerId } },
      update: {},
      create: { teamId: params.teamId, playerId }
    });
    return NextResponse.json({ ok: true });
  } catch (e:any) {
    return NextResponse.json({ error: e.message }, { status: 400 });
  }
}
