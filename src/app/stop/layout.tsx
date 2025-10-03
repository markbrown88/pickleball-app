import type { ReactNode } from 'react';
import { redirect } from 'next/navigation';
import { currentUser } from '@clerk/nextjs/server';

import { AppShell } from '../shared/AppShell';

async function getUserRole(userId: string): Promise<'app-admin' | 'tournament-admin' | 'captain' | 'player'> {
  // For stop pages, we don't need to check roles since they're public
  // But we still need to determine if user is logged in for navigation
  return 'player';
}

export default async function StopLayout({ children }: { children: ReactNode }) {
  const user = await currentUser();

  if (!user) {
    // For public stop pages, redirect to home if not logged in
    redirect('/');
  }

  const userRole = await getUserRole(user.id);

  return (
    <AppShell
      userRole={userRole}
      userInfo={{
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.emailAddresses?.[0]?.emailAddress ?? '',
      }}
      showActAs={false} // No Act As dropdown on stop/scoreboard pages
    >
      {children}
    </AppShell>
  );
}

