import type { ReactNode } from 'react';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { UserButton } from '@clerk/nextjs';
import { currentUser } from '@clerk/nextjs/server';

import { PlayerNavigation, type PlayerNavItem } from './PlayerNavigation';

function buildNavItems(): PlayerNavItem[] {
  return [
    { href: '/dashboard', label: 'Dashboard', exact: true },
    { href: '/profile', label: 'Profile' },
  ];
}

export default async function PlayerLayout({ children }: { children: ReactNode }) {
  const user = await currentUser();

  if (!user) {
    redirect('/');
  }

  const navItems = buildNavItems();

  return (
    <div className="min-h-screen bg-app">
      <div className="flex flex-col md:flex-row min-h-screen">
        <aside className="md:w-64 bg-surface-1 border-b md:border-b-0 md:border-r border-subtle">
          <div className="px-4 py-5 border-b border-subtle">
            <Link href="/" className="text-lg font-semibold text-primary">
              TournaVerse
            </Link>
            <div className="mt-4 space-y-1 text-sm text-muted">
              <div className="font-medium text-secondary">
                {`${(user.firstName ?? '').trim()} ${(user.lastName ?? '').trim()}`.trim() || 'Player'}
              </div>
              <div>{user.emailAddresses?.[0]?.emailAddress ?? ''}</div>
            </div>
          </div>
          <PlayerNavigation items={navItems} />
        </aside>

        <div className="flex-1 flex flex-col">
          <header className="bg-surface-1 border-b border-subtle">
            <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between gap-4">
              <div className="text-sm text-muted">
                Manage your tournaments, teams, and profile.
              </div>
              <div className="flex items-center gap-3">
                <UserButton afterSignOutUrl="/" />
              </div>
            </div>
          </header>

          <main className="flex-1">
            <div className="max-w-7xl mx-auto px-4 py-8 space-y-6">{children}</div>
          </main>
        </div>
      </div>
    </div>
  );
}


