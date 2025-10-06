import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

type Params = {
  params: Promise<{
    stopId: string;
    teamId: string;
  }>;
};

export async function GET(request: Request, { params }: Params) {
  try {
    const { stopId, teamId } = await params;

    // Get stop-specific roster for this team
    const stopTeamPlayers = await prisma.stopTeamPlayer.findMany({
      where: {
        stopId,
        teamId
      },
      include: {
        player: {
          select: {
            id: true,
            name: true,
            firstName: true,
            lastName: true,
            gender: true,
            dupr: true
          }
        }
      }
    });

    const roster = stopTeamPlayers.map(stp => ({
      id: stp.player.id,
      name: stp.player.name || `${stp.player.firstName || ''} ${stp.player.lastName || ''}`.trim(),
      firstName: stp.player.firstName,
      lastName: stp.player.lastName,
      gender: stp.player.gender,
      dupr: stp.player.dupr
    }));

    return NextResponse.json({ items: roster });
  } catch (error) {
    console.error('Failed to load stop roster:', error);
    return NextResponse.json(
      { error: 'Failed to load roster' },
      { status: 500 }
    );
  }
}
