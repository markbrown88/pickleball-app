import { NextResponse } from 'next/server';
import { prisma } from '@/server/db';
import { sendCaptainInviteEmail } from '@/server/email';
import { randomBytes } from 'crypto';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const { teamId, email, captainId, expiresInHours = 96 } = await req.json();
  const team = await prisma.team.findUnique({ where: { id: teamId }, select: { id: true, tournamentId: true }});
  if (!team) return NextResponse.json({ error: 'Team not found' }, { status: 404 });

  const token = randomBytes(24).toString('hex');
  const expiresAt = new Date(Date.now() + expiresInHours * 3600_000);

  const invite = await prisma.captainInvite.create({
    data: {
      teamId,
      tournamentId: team.tournamentId!,
      captainId,
      email,
      token,
      expiresAt,
    },
  });

  const url = new URL(`/captain/${invite.token}`, process.env.NEXT_PUBLIC_APP_URL!);
  await sendCaptainInviteEmail(email, url.toString());
  return NextResponse.json({ ok: true });
}
