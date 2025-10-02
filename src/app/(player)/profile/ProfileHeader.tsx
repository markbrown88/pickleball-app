'use client';

import Link from 'next/link';

import type { UserProfile } from '@/types';

export function ProfileHeader({ userProfile }: { userProfile: UserProfile | null }) {
  const name = userProfile?.firstName && userProfile?.lastName
    ? `${userProfile.firstName} ${userProfile.lastName}`
    : userProfile?.firstName || userProfile?.lastName || 'Player';

  return (
    <header className="rounded-2xl border border-subtle bg-surface-1 p-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-primary">{name}</h1>
          <p className="text-muted mt-1">Manage your player profile and account details</p>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/dashboard" className="btn btn-ghost">
            Back to Dashboard
          </Link>
        </div>
      </div>
    </header>
  );
}

