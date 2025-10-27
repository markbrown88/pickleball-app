export function MatchSkeleton() {
  return (
    <div className="card animate-pulse">
      <div className="flex items-center justify-between mb-4">
        <div className="h-6 bg-surface-2 rounded w-48"></div>
        <div className="h-8 bg-surface-2 rounded w-24"></div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {[1, 2, 3, 4].map(i => (
          <div key={i} className="rounded-lg border-2 border-border-medium p-4">
            <div className="h-4 bg-surface-2 rounded w-32 mb-3"></div>
            <div className="space-y-2">
              <div className="h-6 bg-surface-2 rounded w-full"></div>
              <div className="h-6 bg-surface-2 rounded w-full"></div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function RoundSkeleton({ matchCount = 3 }: { matchCount?: number }) {
  return (
    <div className="space-y-4">
      {Array.from({ length: matchCount }).map((_, i) => (
        <MatchSkeleton key={i} />
      ))}
    </div>
  );
}

export function ScheduleSkeleton({ roundCount = 2 }: { roundCount?: number }) {
  return (
    <div className="space-y-6">
      {Array.from({ length: roundCount }).map((_, i) => (
        <div key={i} className="card">
          <div className="flex items-center justify-between mb-4 p-4 bg-surface-2 rounded-lg">
            <div className="h-6 bg-surface-1 rounded w-32 animate-pulse"></div>
            <div className="h-8 bg-surface-1 rounded w-20 animate-pulse"></div>
          </div>
          <RoundSkeleton matchCount={2} />
        </div>
      ))}
    </div>
  );
}
