import type { ReactNode } from 'react';

export default function TournamentLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-app">
      {children}
    </div>
  );
}

