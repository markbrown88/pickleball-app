'use client';

import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';

type ActAsUser = {
  id: string;
  name: string;
  role: 'app-admin' | 'tournament-admin' | 'captain' | 'player';
};

type ActAsContextType = {
  actingAs: ActAsUser | null;
  setActingAs: (user: ActAsUser | null) => void;
  isActingAs: boolean;
};

const ActAsContext = createContext<ActAsContextType | undefined>(undefined);

export function ActAsProvider({ children }: { children: ReactNode }) {
  const [actingAs, setActingAsState] = useState<ActAsUser | null>(null);

  // Load from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem('act-as-user');
    if (stored) {
      try {
        setActingAsState(JSON.parse(stored));
      } catch (error) {
        console.error('Failed to parse stored act-as user:', error);
        localStorage.removeItem('act-as-user');
      }
    }
  }, []);

  const setActingAs = (user: ActAsUser | null) => {
    setActingAsState(user);
    if (user) {
      localStorage.setItem('act-as-user', JSON.stringify(user));
      // Also set as cookie so server can read it
      document.cookie = `act-as-player-id=${user.id}; path=/; max-age=86400; SameSite=Lax`;
    } else {
      localStorage.removeItem('act-as-user');
      // Remove cookie
      document.cookie = 'act-as-player-id=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT';
    }

    // Force page reload to refetch data with new user context
    if (typeof window !== 'undefined') {
      window.location.reload();
    }
  };

  const isActingAs = actingAs !== null;

  return (
    <ActAsContext.Provider value={{ actingAs, setActingAs, isActingAs }}>
      {children}
    </ActAsContext.Provider>
  );
}

export function useActAs() {
  const context = useContext(ActAsContext);
  if (context === undefined) {
    throw new Error('useActAs must be used within an ActAsProvider');
  }
  return context;
}

