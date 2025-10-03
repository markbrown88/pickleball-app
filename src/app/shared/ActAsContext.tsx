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
    } else {
      localStorage.removeItem('act-as-user');
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

