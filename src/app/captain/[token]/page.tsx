import { prisma } from '@/server/db';
import Link from 'next/link';
import TeamEditor from './team-editor';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function getData(token: string) {
  const invite = await prisma.captainInvite.findUnique({
    where: { token },
    include: {
      team: {
        include: {
          club: true,
          tournament: true,
          playerLinks: { include: { player: { include: { club: true } } } },
          captain: true,
        }
      }
    }
  });
  if (!invite || invite.expiresAt < new Date()) return null;
  return invite;
}

export default async function Page({ params }: { params: { token: string }}) {
  const data = await getData(params.token);
  if (!data) return <div className="p-6">Link invalid or expired.</div>;
  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-semibold">{data.team.tournament?.name} — Captain Console</h1>
      <TeamEditor inviteId={data.id} team={data.team} />
      <div className="text-sm opacity-70">Problems? <Link href="/me" className="underline">Contact admin</Link></div>
    </div>
  );
}
