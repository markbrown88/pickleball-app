'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';
import Link from 'next/link';
import { UserButton } from '@clerk/nextjs';

import { AdminNavigation, type AdminNavItem } from './AdminNavigation';
import type { AdminUser } from './AdminContext';

const ToolbarContext = createContext<(content: ReactNode | null) => void>(() => {});

type AdminShellProps = {
  adminUser: AdminUser;
  navItems: AdminNavItem[];
  children: ReactNode;
};

export function AdminShell({ adminUser, navItems, children }: AdminShellProps) {
  const [toolbarContent, setToolbarContent] = useState<ReactNode | null>(null);

  const handleSetToolbarContent = useCallback((content: ReactNode | null) => {
    setToolbarContent(content);
  }, []);

  const roleBadge = adminUser.isAppAdmin
    ? 'App Admin'
    : adminUser.isTournamentAdmin
    ? 'Tournament Admin'
    : 'Captain';

  const fullName = `${(adminUser.firstName ?? '').trim()} ${(adminUser.lastName ?? '').trim()}`.trim();

  return (
    <ToolbarContext.Provider value={handleSetToolbarContent}>
      <div className="min-h-screen bg-app">
        <div className="flex flex-col md:flex-row min-h-screen">
          <aside className="md:w-64 bg-surface-1 border-b md:border-b-0 md:border-r border-subtle">
            <div className="px-4 py-5 border-b border-subtle">
              <Link href="/" className="text-lg font-semibold text-primary">
                TournaVerse Admin
              </Link>
              <div className="mt-4 space-y-1 text-sm text-muted">
                <div className="font-medium text-secondary">{fullName || 'Admin User'}</div>
                <div className="chip chip-info inline-flex">{roleBadge}</div>
              </div>
            </div>
            <AdminNavigation items={navItems} />
          </aside>

          <div className="flex-1 flex flex-col">
            <header className="bg-surface-1 border-b border-subtle">
              <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between gap-4">
                <div className="text-sm text-muted">
                  Manage tournaments, players, clubs, and rosters within your assigned scope.
                </div>
                <div className="flex items-center gap-3">
                  {toolbarContent}
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
    </ToolbarContext.Provider>
  );
}

export function useAdminToolbar(content: ReactNode | null) {
  const setContent = useContext(ToolbarContext);
  useEffect(() => {
    setContent(content);
    return () => setContent(null);
  }, [content, setContent]);
}

