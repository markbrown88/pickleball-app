export default function Loading() {
  return (
    <div className="min-h-screen bg-surface-1">
      {/* Header Skeleton */}
      <div className="bg-surface-2 border-b border-border-subtle">
        <div className="max-w-4xl mx-auto px-4 py-6">
          <div className="h-8 w-64 bg-surface-3 rounded animate-pulse mb-2" />
          <div className="h-4 w-48 bg-surface-3 rounded animate-pulse" />
        </div>
      </div>

      {/* Stepper Skeleton */}
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="flex items-center flex-1">
              <div className="flex flex-col items-center">
                <div className="w-10 h-10 rounded-full bg-surface-3 animate-pulse" />
                <div className="mt-3 space-y-2">
                  <div className="h-4 w-24 bg-surface-3 rounded animate-pulse" />
                  <div className="h-3 w-20 bg-surface-3 rounded animate-pulse" />
                </div>
              </div>
              {i < 4 && (
                <div
                  className="flex-1 h-0.5 mx-4 bg-surface-3 animate-pulse"
                  style={{ marginBottom: '60px' }}
                />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Content Skeleton */}
      <div className="max-w-4xl mx-auto px-4 pb-12">
        <div className="bg-surface-2 border border-border-subtle rounded-lg p-6">
          <div className="space-y-6">
            {/* Title */}
            <div className="h-7 w-48 bg-surface-3 rounded animate-pulse" />

            {/* Form Fields */}
            <div className="space-y-4">
              <div className="h-20 bg-surface-3 rounded animate-pulse" />
              <div className="h-20 bg-surface-3 rounded animate-pulse" />
              <div className="h-20 bg-surface-3 rounded animate-pulse" />
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-3 pt-4 border-t border-border-subtle">
              <div className="h-10 w-32 bg-surface-3 rounded animate-pulse" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
