'use client';

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { UserButton } from '@clerk/nextjs';

import { Navigation, getNavigationItems, type UserRole } from './Navigation';
import { ActAsProvider, useActAs } from './ActAsContext';
import { ActAsDropdown } from './ActAsDropdown';

const ToolbarContext = createContext<(content: ReactNode | null) => void>(() => {});

type AppShellProps = {
  userRole: UserRole;
  userInfo: {
    firstName?: string | null;
    lastName?: string | null;
    email?: string;
  };
  children: ReactNode;
  showActAs?: boolean;
  availableUsers?: Array<{
    id: string;
    name: string;
    role: 'app-admin' | 'tournament-admin' | 'event-manager' | 'captain' | 'player';
    email?: string;
  }>;
};

function AppShellContent({ userRole, userInfo, children, showActAs = false, availableUsers = [] }: AppShellProps) {
  const [toolbarContent, setToolbarContent] = useState<ReactNode | null>(null);
  const { actingAs } = useActAs();

  const handleSetToolbarContent = useCallback((content: ReactNode | null) => {
    setToolbarContent(content);
  }, []);

  const fullName = `${(userInfo.firstName ?? '').trim()} ${(userInfo.lastName ?? '').trim()}`.trim();
  const displayName = fullName || 'User';

  // Always use server-detected userRole for navigation (it's already Act As-aware)
  // Use actingAs for display name only
  const displayUser = actingAs ? actingAs.name : displayName;

  const roleBadge = userRole === 'app-admin'
    ? 'App Admin'
    : userRole === 'tournament-admin'
    ? 'Tournament Admin'
    : userRole === 'event-manager'
    ? 'Event Manager'
    : userRole === 'captain'
    ? 'Captain'
    : 'Player';

  const navItems = getNavigationItems();

  return (
    <ToolbarContext.Provider value={handleSetToolbarContent}>
      <div className="min-h-screen bg-app">
        <div className="flex flex-col md:flex-row min-h-screen">
          <aside className="md:w-64 bg-surface-1 border-b md:border-b-0 md:border-r border-subtle">
            <div className="px-4 py-5 border-b border-subtle">
              <Link href="/" className="text-lg font-semibold text-primary">
                Klyng Cup
              </Link>
              <div className="mt-4 space-y-1 text-sm text-muted">
                <div className="font-medium text-secondary">{displayUser}</div>
                <div className="chip chip-info inline-flex text-xs">{roleBadge}</div>
                {actingAs && (
                  <div className="text-xs text-warning">
                    Acting as {actingAs.name}
                  </div>
                )}
              </div>
            </div>
            <Navigation items={navItems} userRole={userRole} />
          </aside>

          <div className="flex-1 flex flex-col">
            <header className="bg-surface-1 border-b border-subtle">
              <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-end gap-3">
                {toolbarContent}
                {showActAs && (
                  <ActAsDropdown
                    currentUser={{
                      id: 'current',
                      name: displayName,
                      role: userRole === 'event-manager' ? 'player' : userRole,
                    }}
                    availableUsers={availableUsers.filter(user => 
                      user.role !== 'event-manager'
                    ) as Array<{
                      id: string;
                      name: string;
                      role: 'app-admin' | 'tournament-admin' | 'captain' | 'player';
                      email?: string;
                    }>}
                  />
                )}
                <UserButton afterSignOutUrl="/" />
              </div>
            </header>

            <main className="flex-1">
              <div className="max-w-7xl mx-auto px-4 py-8 space-y-6">{children}</div>
            </main>
          </div>
        </div>
      </div>
    </ToolbarContext.Provider>
  );
}

export function AppShell(props: AppShellProps) {
  return (
    <ActAsProvider>
      <AppShellContent {...props} />
    </ActAsProvider>
  );
}

export function useAppToolbar(content: ReactNode | null) {
  const setContent = useContext(ToolbarContext);
  useEffect(() => {
    setContent(content);
    return () => setContent(null);
  }, [content, setContent]);
}
