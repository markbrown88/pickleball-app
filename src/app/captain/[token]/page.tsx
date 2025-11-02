'use client';

import { use, useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { formatDateUTC, formatDateRangeUTC } from '@/lib/utils';

type Stop = {
  id: string;
  name: string;
  startAt: string | null;
  endAt: string | null;
  lineupDeadline: string | null;
  status: 'completed' | 'upcoming' | 'current';
  lineupsComplete: boolean;
  club: {
    id: string;
    name: string;
  } | null;
};

type CaptainPortalData = {
  tournament: {
    id: string;
    name: string;
  };
  club: {
    id: string;
    name: string;
  };
  stops: Stop[];
};

export default function CaptainPortalPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = use(params);
  const router = useRouter();
  const [data, setData] = useState<CaptainPortalData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadData() {
      try {
        const response = await fetch(`/api/captain-portal/${token}`);
        if (!response.ok) {
          throw new Error('Invalid access token or tournament not found');
        }
        const result = await response.json();
        setData(result);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load data');
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, [token]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface-1">
        <div className="text-center">
          <div className="spinner mx-auto mb-4"></div>
          <p className="text-muted">Loading captain portal...</p>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface-1">
        <div className="card p-8 max-w-md">
          <h1 className="text-2xl font-bold text-error mb-4">Access Denied</h1>
          <p className="text-muted">{error || 'Invalid access link'}</p>
        </div>
      </div>
    );
  }

  const upcomingStops = data.stops.filter(s => s.status !== 'completed');
  const completedStops = data.stops.filter(s => s.status === 'completed');

  return (
    <div className="min-h-screen">
      {/* Sticky Header */}
      <div className="sticky top-0 bg-primary text-white py-4 px-4 z-50 shadow-lg">
        <div className="container mx-auto max-w-4xl">
          <h1 className="text-sm sm:text-base md:text-lg lg:text-xl xl:text-2xl font-bold mb-1">{data.tournament.name}</h1>
          <p className="text-xs sm:text-sm md:text-base opacity-90">{data.club.name}</p>
        </div>
      </div>

      {/* Main Content */}
      <div className="px-4 py-8">
        <div className="container mx-auto max-w-4xl">
          {/* Upcoming Stops */}
          {upcomingStops.length > 0 && (
            <div className="mb-6 md:mb-8">
              <h2 className="text-lg md:text-2xl font-semibold text-primary mb-3 md:mb-4">Upcoming Stops</h2>
              <div className="grid gap-3 md:gap-4">
                {upcomingStops.map((stop) => (
                  <StopCard
                    key={stop.id}
                    stop={stop}
                    onClick={() => router.push(`/captain/${token}/stop/${stop.id}`)}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Completed Stops */}
          {completedStops.length > 0 && (
            <div>
              <h2 className="text-lg md:text-2xl font-semibold text-muted mb-3 md:mb-4">Completed Stops</h2>
              <div className="grid gap-3 md:gap-4">
                {completedStops.map((stop) => (
                  <StopCard
                    key={stop.id}
                    stop={stop}
                    completed
                    onClick={() => router.push(`/captain/${token}/stop/${stop.id}`)}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function StopCard({
  stop,
  completed = false,
  onClick,
}: {
  stop: Stop;
  completed?: boolean;
  onClick: () => void;
}) {
  const getDeadlineStatus = () => {
    if (!stop.lineupDeadline) return null;
    const deadline = new Date(stop.lineupDeadline);
    const now = new Date();
    const stopStart = stop.startAt ? new Date(stop.startAt) : null;

    // Don't show deadline status if stop has already started
    if (stopStart && now >= stopStart) return null;

    const diff = deadline.getTime() - now.getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const days = Math.floor(hours / 24);

    if (diff < 0) {
      // Show the actual deadline date when passed
      return { text: formatDateUTC(stop.lineupDeadline), color: 'text-error' };
    } else if (hours < 24) {
      return { text: `${hours}h remaining`, color: 'text-warning' };
    } else {
      return { text: `${days}d remaining`, color: 'text-muted' };
    }
  };

  const getDateRange = () => {
    if (!stop.startAt) return null;
    return formatDateRangeUTC(stop.startAt, stop.endAt);
  };

  const deadlineStatus = getDeadlineStatus();
  const dateRange = getDateRange();

  return (
    <button
      onClick={onClick}
      disabled={completed}
      className={`card p-4 md:p-6 text-left transition-all active:scale-95 hover:shadow-lg ${
        completed ? 'opacity-60 cursor-not-allowed' : 'hover:border-primary active:bg-surface-2'
      }`}
    >
      <div className="space-y-2">
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0 pr-2">
            <h3 className="text-base md:text-lg font-semibold text-primary truncate">
              {stop.name}{stop.club?.name && ` @ ${stop.club.name}`}
            </h3>
            {dateRange && (
              <p className="text-sm text-muted mt-1">
                {dateRange}
              </p>
            )}
          </div>
          <div className="flex-shrink-0">
            {stop.lineupsComplete && (
              <span className="chip chip-success text-xs">
                <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
                Complete
              </span>
            )}
            {completed && (
              <span className="chip chip-muted text-xs">Completed</span>
            )}
          </div>
        </div>
        
        {deadlineStatus && !completed && (
          <p className={`text-sm font-medium ${deadlineStatus.color}`}>
            Lineup Deadline: {deadlineStatus.text}
          </p>
        )}
      </div>
    </button>
  );
}
