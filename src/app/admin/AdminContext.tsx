'use client';

import { createContext, useContext, type ReactNode } from 'react';

export type AdminUser = {
  id: string;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  isAppAdmin: boolean;
  isTournamentAdmin: boolean;
  isCaptain: boolean;
};

const AdminContext = createContext<AdminUser | null>(null);

export function AdminProvider({ value, children }: { value: AdminUser; children: ReactNode }) {
  return <AdminContext.Provider value={value}>{children}</AdminContext.Provider>;
}

export function useAdminUser() {
  const context = useContext(AdminContext);
  if (!context) {
    throw new Error('useAdminUser must be used within an AdminProvider');
  }
  return context;
}
