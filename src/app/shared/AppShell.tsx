'use client';

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import dynamic from 'next/dynamic';

import { Navigation, getNavigationItems, type UserRole } from './Navigation';
import { ActAsProvider, useActAs } from './ActAsContext';
import { ActAsDropdown } from './ActAsDropdown';

// Dynamically import UserButton to avoid hydration mismatch
const DynamicUserButton = dynamic(
  () => import('@clerk/nextjs').then((mod) => mod.UserButton),
  { ssr: false }
);

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
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);
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
        {/* Mobile backdrop overlay */}
        {isMobileNavOpen && (
          <div
            className="fixed inset-0 bg-black bg-opacity-50 z-40 md:hidden"
            onClick={() => setIsMobileNavOpen(false)}
          />
        )}

        <div className="flex flex-col md:flex-row min-h-screen">
          {/* Sidebar - Fixed on desktop, collapsible on mobile */}
          <aside className={`
            fixed md:fixed inset-y-0 left-0 z-50 md:z-auto
            w-64 bg-surface-1 border-b md:border-b-0 md:border-r border-subtle
            transform transition-transform duration-300 ease-in-out
            ${isMobileNavOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
            md:translate-x-0
          `}>
            <div className="px-4 py-5 border-b border-subtle">
              <div className="flex items-center justify-between">
                <Link href="/" className="flex items-center">
                  <Image 
                    src="/images/klyng-cup.png" 
                    alt="Klyng Cup" 
                    width={120} 
                    height={40}
                    className="h-6 w-auto"
                    priority
                  />
                </Link>
                {/* Mobile close button */}
                <button
                  onClick={() => setIsMobileNavOpen(false)}
                  className="md:hidden p-2 rounded-md text-muted hover:text-primary hover:bg-surface-2 transition-colors"
                  aria-label="Close navigation menu"
                >
                  <svg
                    className="w-5 h-5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                </button>
              </div>
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
            <Navigation 
              items={navItems} 
              userRole={userRole} 
              onMobileNavClose={() => setIsMobileNavOpen(false)}
            />
          </aside>

          <div className="flex-1 flex flex-col md:ml-64">
            <header className="bg-surface-1 border-b border-subtle">
              <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between md:justify-end gap-3">
                {/* Mobile hamburger menu button */}
                <button
                  onClick={() => setIsMobileNavOpen(!isMobileNavOpen)}
                  className="md:hidden p-2 rounded-md text-muted hover:text-primary hover:bg-surface-2 transition-colors"
                  aria-label="Toggle navigation menu"
                >
                  <svg
                    className="w-6 h-6"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    {isMobileNavOpen ? (
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M6 18L18 6M6 6l12 12"
                      />
                    ) : (
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M4 6h16M4 12h16M4 18h16"
                      />
                    )}
                  </svg>
                </button>

                {/* Mobile logo - centered */}
                <div className="md:hidden flex-1 flex justify-center">
                  <Link href="/">
                    <Image
                      src="/images/klyng-cup.png"
                      alt="Klyng Cup"
                      width={80}
                      height={43}
                      className="h-8 w-auto"
                      priority
                    />
                  </Link>
                </div>

                <div className="flex items-center gap-3">
                  {toolbarContent}
                  {showActAs && (
                    <div className="hidden md:block">
                      <ActAsDropdown
                        currentUser={{
                          id: 'current',
                          name: displayName,
                          role: userRole,
                        }}
                        availableUsers={availableUsers}
                      />
                    </div>
                  )}
                  <DynamicUserButton
                    appearance={{
                      elements: {
                        userButtonPopoverActionButton: '!text-white hover:!text-white',
                        userButtonPopoverActionButtonText: '!text-white',
                        userButtonPopoverActionButtonIcon: '!text-white',
                      }
                    }}
                  />
                </div>
              </div>
            </header>

            {/* Mobile Act As Dropdown - Below header */}
            {showActAs && (
              <div className="md:hidden bg-surface-1 border-b border-subtle px-4 py-3">
                <ActAsDropdown
                  currentUser={{
                    id: 'current',
                    name: displayName,
                    role: userRole,
                  }}
                  availableUsers={availableUsers}
                />
              </div>
            )}

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
