'use client';

import { useState } from 'react';

export type Stop = {
  id: string;
  name: string;
  startAt: Date;
  registrationDeadline?: Date | null;
  isRegistrationClosed?: boolean;
};

type StopRegistrationSettingsProps = {
  stops: Stop[];
  onStopsChange: (stops: Stop[]) => void;
};

export function StopRegistrationSettings({ stops, onStopsChange }: StopRegistrationSettingsProps) {
  const [expandedStopId, setExpandedStopId] = useState<string | null>(null);

  // Format date for display
  const formatDate = (date: Date): string => {
    return new Date(date).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  // Format date for input (YYYY-MM-DD)
  const formatDateForInput = (date: Date): string => {
    const d = new Date(date);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  // Update a specific stop
  const updateStop = (stopId: string, updates: Partial<Stop>) => {
    const newStops = stops.map((stop) =>
      stop.id === stopId ? { ...stop, ...updates } : stop
    );
    onStopsChange(newStops);
  };

  // Set deadline relative to start date
  const setDeadlineRelative = (stopId: string, daysBefore: number) => {
    const stop = stops.find((s) => s.id === stopId);
    if (!stop) return;

    const deadline = new Date(stop.startAt);
    deadline.setDate(deadline.getDate() - daysBefore);
    updateStop(stopId, { registrationDeadline: deadline });
  };

  // Apply bulk deadline to all stops
  const applyBulkDeadline = (daysBefore: number) => {
    const newStops = stops.map((stop) => {
      const deadline = new Date(stop.startAt);
      deadline.setDate(deadline.getDate() - daysBefore);
      return { ...stop, registrationDeadline: deadline };
    });
    onStopsChange(newStops);
  };

  if (stops.length === 0) {
    return (
      <div className="p-4 bg-surface-2 border border-border-subtle rounded">
        <p className="text-sm text-muted">
          No stops configured yet. Add stops to your tournament before configuring registration settings.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h4 className="text-sm font-semibold text-secondary mb-2">Stop Registration Settings</h4>
        <p className="text-xs text-muted mb-4">
          Configure registration deadlines for each stop. Registration will automatically close at the deadline.
          You can also manually close registration at any time.
        </p>
      </div>

      {/* Bulk Actions */}
      <div className="p-4 bg-surface-2 border border-border-subtle rounded">
        <div className="text-sm font-medium text-secondary mb-3">Quick Actions</div>
        <div className="flex flex-wrap gap-2">
          <button
            className="btn btn-secondary text-sm"
            onClick={() => applyBulkDeadline(7)}
          >
            Set All: 7 Days Before
          </button>
          <button
            className="btn btn-secondary text-sm"
            onClick={() => applyBulkDeadline(3)}
          >
            Set All: 3 Days Before
          </button>
          <button
            className="btn btn-secondary text-sm"
            onClick={() => applyBulkDeadline(1)}
          >
            Set All: 1 Day Before
          </button>
          <button
            className="btn btn-ghost text-sm"
            onClick={() => {
              const newStops = stops.map((s) => ({
                ...s,
                registrationDeadline: null,
              }));
              onStopsChange(newStops);
            }}
          >
            Clear All Deadlines
          </button>
        </div>
      </div>

      {/* Stop List */}
      <div className="space-y-3">
        {stops.map((stop) => {
          const isExpanded = expandedStopId === stop.id;
          const hasDeadline = !!stop.registrationDeadline;
          const isPastDeadline =
            hasDeadline &&
            stop.registrationDeadline &&
            new Date(stop.registrationDeadline) < new Date();

          return (
            <div
              key={stop.id}
              className="border border-border-subtle rounded overflow-hidden"
            >
              {/* Stop Header */}
              <button
                className="w-full p-4 flex items-center justify-between hover:bg-surface-2 transition-colors text-left"
                onClick={() => setExpandedStopId(isExpanded ? null : stop.id)}
              >
                <div className="flex-1">
                  <div className="flex items-center gap-3">
                    <div className="font-medium text-secondary">{stop.name}</div>
                    <div className="text-xs text-muted">
                      {formatDate(stop.startAt)}
                    </div>
                  </div>
                  <div className="flex items-center gap-3 mt-1">
                    {hasDeadline && stop.registrationDeadline ? (
                      <div
                        className={`text-xs ${isPastDeadline ? 'text-error' : 'text-muted'}`}
                      >
                        Deadline: {formatDate(stop.registrationDeadline)}
                        {isPastDeadline && ' (Past)'}
                      </div>
                    ) : (
                      <div className="text-xs text-muted">No deadline set</div>
                    )}
                    {stop.isRegistrationClosed && (
                      <div className="text-xs px-2 py-0.5 bg-error/20 text-error rounded">
                        Closed
                      </div>
                    )}
                  </div>
                </div>
                <svg
                  className={`w-5 h-5 text-muted transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 9l-7 7-7-7"
                  />
                </svg>
              </button>

              {/* Stop Details (Expanded) */}
              {isExpanded && (
                <div className="p-4 border-t border-border-subtle bg-surface-1 space-y-4">
                  {/* Registration Deadline */}
                  <div>
                    <label className="block text-sm font-medium text-secondary mb-2">
                      Registration Deadline
                    </label>
                    <div className="space-y-2">
                      <input
                        type="date"
                        className="input w-full max-w-xs"
                        value={
                          stop.registrationDeadline
                            ? formatDateForInput(new Date(stop.registrationDeadline))
                            : ''
                        }
                        onChange={(e) => {
                          const value = e.target.value;
                          updateStop(stop.id, {
                            registrationDeadline: value ? new Date(value) : null,
                          });
                        }}
                        max={formatDateForInput(stop.startAt)}
                      />
                      <div className="flex gap-2">
                        <button
                          className="btn btn-secondary text-xs"
                          onClick={() => setDeadlineRelative(stop.id, 7)}
                        >
                          7 Days Before
                        </button>
                        <button
                          className="btn btn-secondary text-xs"
                          onClick={() => setDeadlineRelative(stop.id, 3)}
                        >
                          3 Days Before
                        </button>
                        <button
                          className="btn btn-secondary text-xs"
                          onClick={() => setDeadlineRelative(stop.id, 1)}
                        >
                          1 Day Before
                        </button>
                        <button
                          className="btn btn-ghost text-xs"
                          onClick={() =>
                            updateStop(stop.id, { registrationDeadline: null })
                          }
                        >
                          Clear
                        </button>
                      </div>
                    </div>
                    <p className="text-xs text-muted mt-2">
                      Registration will automatically close at this date/time. Leave blank for no
                      automatic closure.
                    </p>
                  </div>

                  {/* Manual Close Toggle */}
                  <div>
                    <label className="flex items-start gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        className="mt-1"
                        checked={stop.isRegistrationClosed ?? false}
                        onChange={(e) =>
                          updateStop(stop.id, { isRegistrationClosed: e.target.checked })
                        }
                      />
                      <div>
                        <div className="font-medium text-secondary">
                          Manually Close Registration
                        </div>
                        <p className="text-xs text-muted">
                          Close registration immediately, regardless of deadline. Useful for
                          one-off closures or capacity issues.
                        </p>
                      </div>
                    </label>
                  </div>

                  {/* Status Summary */}
                  <div className="border-t border-border-subtle pt-3">
                    <div className="text-xs font-medium text-secondary mb-1">Current Status</div>
                    <div className="text-sm text-muted">
                      {stop.isRegistrationClosed ? (
                        <span className="text-error font-medium">
                          Registration is manually closed
                        </span>
                      ) : isPastDeadline ? (
                        <span className="text-error font-medium">
                          Registration closed (deadline passed)
                        </span>
                      ) : hasDeadline ? (
                        <span className="text-success font-medium">
                          Registration open until{' '}
                          {stop.registrationDeadline &&
                            formatDate(new Date(stop.registrationDeadline))}
                        </span>
                      ) : (
                        <span className="text-success font-medium">
                          Registration open (no deadline)
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Summary */}
      <div className="border-t border-border-subtle pt-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
          <div>
            <span className="text-muted">Total Stops:</span>
            <span className="ml-2 font-semibold text-secondary">{stops.length}</span>
          </div>
          <div>
            <span className="text-muted">With Deadlines:</span>
            <span className="ml-2 font-semibold text-secondary">
              {stops.filter((s) => s.registrationDeadline).length}
            </span>
          </div>
          <div>
            <span className="text-muted">Manually Closed:</span>
            <span className="ml-2 font-semibold text-secondary">
              {stops.filter((s) => s.isRegistrationClosed).length}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
