'use client';

import Image from 'next/image';
import Link from 'next/link';

import type { UserProfile } from '@/types';

export function ProfileHeader({ userProfile }: { userProfile: UserProfile | null }) {
  const name = userProfile?.firstName && userProfile?.lastName
    ? `${userProfile.firstName} ${userProfile.lastName}`
    : userProfile?.firstName || userProfile?.lastName || 'Player';

  return (
    <header className="rounded-2xl border border-subtle bg-surface-1 p-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          {userProfile?.image ? (
            <div className="relative h-16 w-16 overflow-hidden rounded-full border-2 border-brand-secondary">
              <Image
                src={userProfile.image}
                alt={name}
                fill
                className="object-cover"
              />
            </div>
          ) : (
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-surface-2 border-2 border-subtle text-2xl font-bold text-muted">
              {name.charAt(0)}
            </div>
          )}
          <div>
            <h1 className="text-3xl font-bold text-primary">{name}</h1>
            <p className="text-muted mt-1">Manage your player profile and account details</p>
          </div>
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

