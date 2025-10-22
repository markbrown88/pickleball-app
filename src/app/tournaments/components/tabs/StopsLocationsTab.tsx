'use client';

import React, { useState, useRef, useEffect } from 'react';
import type { EditorRow, StopEditorRow, Club, CaptainPick } from '../TournamentEditor';

type StopsLocationsTabProps = {
  editor: EditorRow;
  setEditor: (editor: EditorRow) => void;
  clubsAll: Club[];
  searchPlayers: (term: string) => Promise<Array<{ id: string; label: string }>>;
};

export function StopsLocationsTab({ editor, setEditor, clubsAll, searchPlayers }: StopsLocationsTabProps) {
  const searchTimers = useRef<Record<string, number>>({});

  const addStopRow = () => {
    setEditor({
      ...editor,
      stops: [
        ...(editor.stops || []),
        {
          name: '',
          eventManager: null,
          eventManagerQuery: '',
          eventManagerOptions: [],
          club: null,
          clubQuery: '',
          clubOptions: [],
        },
      ],
    });
  };

  const updateStopRow = (index: number, patch: Partial<StopEditorRow>) => {
    const next = [...(editor.stops || [])];
    next[index] = { ...next[index], ...patch };
    setEditor({ ...editor, stops: next });
  };

  const removeStopRow = (index: number) => {
    const next = [...(editor.stops || [])];
    next.splice(index, 1);
    setEditor({ ...editor, stops: next });
  };

  const setStopClubQuery = (index: number, query: string) => {
    updateStopRow(index, { clubQuery: query, clubOptions: [] });

    const key = `stop-club-${index}`;
    if (searchTimers.current[key]) clearTimeout(searchTimers.current[key]);

    if (query.trim().length >= 2) {
      searchTimers.current[key] = window.setTimeout(() => {
        const filtered = clubsAll
          .filter((c) => {
            const label = `${c.name} ${c.city || ''} ${c.region || ''}`.toLowerCase();
            return label.includes(query.toLowerCase());
          })
          .map((c) => ({
            id: c.id,
            label: `${c.name}${c.city ? ` (${c.city})` : ''}`,
          }));
        updateStopRow(index, { clubOptions: filtered });
      }, 300);
    }
  };

  const chooseStopClub = (index: number, pick: { id: string; label: string }) => {
    updateStopRow(index, {
      clubId: pick.id,
      club: pick,
      clubQuery: '',
      clubOptions: [],
    });
  };

  const removeStopClub = (index: number) => {
    updateStopRow(index, {
      clubId: undefined,
      club: null,
      clubQuery: '',
      clubOptions: [],
    });
  };

  const setStopEventManagerQuery = (index: number, query: string) => {
    updateStopRow(index, { eventManagerQuery: query, eventManagerOptions: [] });

    const key = `stop-mgr-${index}`;
    if (searchTimers.current[key]) clearTimeout(searchTimers.current[key]);

    if (query.trim().length >= 3) {
      searchTimers.current[key] = window.setTimeout(async () => {
        const opts = await searchPlayers(query.trim());
        updateStopRow(index, { eventManagerOptions: opts });
      }, 300);
    }
  };

  const chooseStopEventManager = (index: number, pick: { id: string; label: string }) => {
    updateStopRow(index, {
      eventManager: pick,
      eventManagerQuery: '',
      eventManagerOptions: [],
    });
  };

  const removeStopEventManager = (index: number) => {
    updateStopRow(index, {
      eventManager: null,
      eventManagerQuery: '',
      eventManagerOptions: [],
    });
  };

  const stops = editor.stops || [];

  // Auto-create single stop if needed (in useEffect to avoid setState during render)
  useEffect(() => {
    if (!editor.hasMultipleStops && stops.length === 0) {
      const singleStop: StopEditorRow = {
        name: 'Main',
        eventManager: null,
        eventManagerQuery: '',
        eventManagerOptions: [],
        club: null,
        clubQuery: '',
        clubOptions: [],
      };
      setEditor({ ...editor, stops: [singleStop] });
    }
  }, [editor.hasMultipleStops, stops.length]); // Only run when these values change

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h3 className="text-lg font-semibold text-primary mb-2">Tournament Location(s) & Dates</h3>
        <p className="text-sm text-muted">
          Configure tournament location, dates, and event manager
        </p>
      </div>

      <div className="space-y-4">
        {stops.map((stop, index) => (
          <div
            key={index}
            className={`space-y-4 ${
              editor.hasMultipleStops
                ? 'border-2 border-border-medium rounded-lg p-6 bg-surface-1'
                : ''
            }`}
          >
            {editor.hasMultipleStops && (
              <div className="flex items-center justify-between">
                <h4 className="font-semibold text-secondary">Stop {index + 1}</h4>
                {stops.length > 1 && (
                  <button
                    className="text-error hover:text-error-hover text-sm"
                    onClick={() => removeStopRow(index)}
                  >
                    Remove Stop
                  </button>
                )}
              </div>
            )}

            {editor.hasMultipleStops && (
              <div>
                <label className="block text-sm font-semibold text-secondary mb-2">
                  Stop Name <span className="text-error">*</span>
                </label>
                <input
                  type="text"
                  className="input w-full"
                  value={stop.name}
                  onChange={(e) => updateStopRow(index, { name: e.target.value })}
                  placeholder="e.g., Regional Qualifier, Championship Round"
                />
              </div>
            )}

            <div>
              <label className="block text-sm font-semibold text-secondary mb-2">
                Location (Club)
              </label>
              {stop.club ? (
                <div className="flex items-center gap-2">
                  <span className="chip chip-info">{stop.club.label}</span>
                  <button
                    className="text-error hover:text-error-hover text-sm"
                    onClick={() => removeStopClub(index)}
                  >
                    Remove
                  </button>
                </div>
              ) : (
                <div className="relative">
                  <input
                    type="text"
                    className="input w-full"
                    value={stop.clubQuery || ''}
                    onChange={(e) => setStopClubQuery(index, e.target.value)}
                    placeholder="Type 2+ characters to search clubs..."
                  />
                  {stop.clubOptions && stop.clubOptions.length > 0 && (
                    <div className="absolute z-10 w-full mt-1 border border-subtle rounded bg-surface-1 max-h-48 overflow-auto shadow-lg">
                      {stop.clubOptions.map((opt) => (
                        <button
                          key={opt.id}
                          className="block w-full text-left px-3 py-2 hover:bg-surface-2 text-sm"
                          onClick={() => chooseStopClub(index, opt)}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold text-secondary mb-2">
                  Start Date
                </label>
                <input
                  type="date"
                  className="input w-full"
                  value={stop.startAt || ''}
                  onChange={(e) => updateStopRow(index, { startAt: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-secondary mb-2">
                  End Date
                </label>
                <input
                  type="date"
                  className="input w-full"
                  value={stop.endAt || ''}
                  onChange={(e) => updateStopRow(index, { endAt: e.target.value })}
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-secondary mb-2">
                Event Manager (for this location)
              </label>
              {stop.eventManager ? (
                <div className="flex items-center gap-2">
                  <span className="chip chip-info">{stop.eventManager.label}</span>
                  <button
                    className="text-error hover:text-error-hover text-sm"
                    onClick={() => removeStopEventManager(index)}
                  >
                    Remove
                  </button>
                </div>
              ) : (
                <div className="relative">
                  <input
                    type="text"
                    className="input w-full"
                    value={stop.eventManagerQuery || ''}
                    onChange={(e) => setStopEventManagerQuery(index, e.target.value)}
                    placeholder="Type 3+ characters to search players..."
                  />
                  {stop.eventManagerOptions && stop.eventManagerOptions.length > 0 && (
                    <div className="absolute z-10 w-full mt-1 border border-subtle rounded bg-surface-1 max-h-48 overflow-auto shadow-lg">
                      {stop.eventManagerOptions.map((opt) => (
                        <button
                          key={opt.id}
                          className="block w-full text-left px-3 py-2 hover:bg-surface-2 text-sm"
                          onClick={() => chooseStopEventManager(index, opt)}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
              <p className="text-xs text-muted mt-1">
                Overrides tournament-level event manager for this specific location
              </p>
            </div>
          </div>
        ))}
      </div>

      {editor.hasMultipleStops && (
        <button className="btn btn-secondary" onClick={addStopRow}>
          + Add Stop
        </button>
      )}
    </div>
  );
}
