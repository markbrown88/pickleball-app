'use client';

import { formatDateRangeUTC } from '@/lib/utils';

type Id = string;

type TournamentRow = {
  id: Id;
  name: string;
  createdAt: string;
  stats: {
    stopCount: number;
    participatingClubs: string[];
    dateRange: { start: string | null; end: string | null };
  };
};

type TournamentsListProps = {
  tournaments: TournamentRow[];
  loading?: boolean;
  onEdit: (tournamentId: Id) => void;
  onDelete: (tournamentId: Id) => void;
};

export function TournamentsList({ tournaments, loading, onEdit, onDelete }: TournamentsListProps) {
  if (tournaments.length === 0) {
    return (
      <div className="card p-8 text-center">
        <div className="max-w-md mx-auto space-y-3">
          <div className="text-5xl">🏆</div>
          <h3 className="text-lg font-semibold text-secondary">
            {loading ? 'Loading tournaments...' : 'No Tournaments Yet'}
          </h3>
          {!loading && (
            <p className="text-muted">
              Create your first tournament to get started with managing your pickleball events.
            </p>
          )}
        </div>
      </div>
    );
  }

  const getStatus = (dateRange: { start: string | null; end: string | null }) => {
    const now = new Date();
    const startDate = dateRange.start ? new Date(dateRange.start) : null;
    const endDate = dateRange.end ? new Date(dateRange.end) : null;

    if (startDate && endDate) {
      if (now < startDate) return { label: 'Upcoming', className: 'chip-info' };
      if (now >= startDate && now <= endDate) return { label: 'In Progress', className: 'chip-warning' };
      return { label: 'Complete', className: 'chip-success' };
    }

    return { label: 'Upcoming', className: 'chip-info' };
  };

  return (
    <div className="card overflow-hidden">
      <div className="overflow-x-auto">
        <table className="table">
          <thead>
            <tr>
              <th className="text-left">Tournament Name</th>
              <th className="text-center">Status</th>
              <th className="text-center">Clubs</th>
              <th className="text-center">Stops</th>
              <th className="text-center">Dates</th>
              <th className="text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {tournaments.map((tournament) => {
              const status = getStatus(tournament.stats.dateRange);

              return (
                <tr key={tournament.id} className="hover:bg-surface-1/50">
                  <td>
                    <button
                      className="font-medium text-primary hover:text-secondary-hover hover:underline text-left"
                      onClick={() => onEdit(tournament.id)}
                    >
                      {tournament.name}
                    </button>
                  </td>
                  <td className="text-center">
                    <span className={`chip ${status.className}`}>
                      {status.label}
                    </span>
                  </td>
                  <td className="text-center text-muted tabular">
                    {tournament.stats.participatingClubs.length}
                  </td>
                  <td className="text-center text-muted tabular">
                    {tournament.stats.stopCount}
                  </td>
                  <td className="text-center text-muted tabular">
                    {formatDateRangeUTC(tournament.stats.dateRange.start, tournament.stats.dateRange.end)}
                  </td>
                  <td className="text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        className="btn btn-ghost btn-sm"
                        onClick={() => onEdit(tournament.id)}
                      >
                        Edit
                      </button>
                      <button
                        className="text-error hover:text-error-hover p-1"
                        onClick={() => {
                          if (confirm(`Are you sure you want to delete "${tournament.name}"? This action cannot be undone.`)) {
                            onDelete(tournament.id);
                          }
                        }}
                        title="Delete tournament"
                        aria-label="Delete tournament"
                      >
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
                          <path d="M3 6h18" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                          <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                          <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                          <path d="M10 11v6M14 11v6" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                        </svg>
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
