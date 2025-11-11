'use client';

import { useRef, useState } from 'react';
import type { EditorRow, Club, ClubWithCaptain, CaptainPick } from '../TournamentEditor';

type ClubsCaptainsTabProps = {
  editor: EditorRow;
  setEditor: (editor: EditorRow) => void;
  clubsAll: Club[];
  searchPlayers: (term: string) => Promise<Array<{ id: string; label: string }>>;
};

export function ClubsCaptainsTab({ editor, setEditor, clubsAll, searchPlayers }: ClubsCaptainsTabProps) {
  const searchTimers = useRef<Record<string, number>>({});
  const [globalClubQuery, setGlobalClubQueryState] = useState('');
  const [globalClubOptions, setGlobalClubOptions] = useState<Array<{ id: string; label: string }>>([]);
  const [editingClubIdx, setEditingClubIdx] = useState<number | null>(null);

  // Global club search
  const runGlobalClubSearch = (query: string) => {
    if (query.trim().length < 3) {
      setGlobalClubOptions([]);
      return;
    }

    const selectedClubIds = new Set(editor.clubs.map((c) => c.clubId).filter(Boolean) as string[]);
    const available = clubsAll.filter((c) => !selectedClubIds.has(c.id));
    const filtered = available
      .filter((c) => {
        const label = `${c.name} ${c.city || ''} ${c.region || ''}`.toLowerCase();
        return label.includes(query.toLowerCase());
      })
      .map((c) => ({
        id: c.id,
        label: `${c.name}${c.city ? ` (${c.city})` : ''}`,
      }));

    setGlobalClubOptions(filtered);
  };

  const setGlobalClubQuery = (query: string) => {
    setGlobalClubQueryState(query);
    const key = 'global-club';
    if (searchTimers.current[key]) clearTimeout(searchTimers.current[key]);
    searchTimers.current[key] = window.setTimeout(() => runGlobalClubSearch(query), 300);
  };

  const addClubFromGlobalSearch = (pick: { id: string; label: string }) => {
    // Check if club already exists
    if (editor.clubs.some((c) => c.clubId === pick.id)) return;

    const newClub: ClubWithCaptain = {
      clubId: pick.id,
      club: pick,
      clubQuery: '',
      clubOptions: [],
      singleCaptain: null,
      singleQuery: '',
      singleOptions: [],
    };

    setEditor({
      ...editor,
      clubs: [...editor.clubs, newClub],
    });

    setGlobalClubQueryState('');
    setGlobalClubOptions([]);
  };

  const removeClubRow = (index: number) => {
    const next = [...editor.clubs];
    next.splice(index, 1);
    setEditor({ ...editor, clubs: next });
    if (editingClubIdx === index) {
      setEditingClubIdx(null);
    } else if (editingClubIdx !== null && editingClubIdx > index) {
      setEditingClubIdx(editingClubIdx - 1);
    }
  };

  const availableClubsForRow = (index: number) => {
    const chosen = new Set(editor.clubs.map((c) => c.clubId).filter(Boolean) as string[]);
    const current = editor.clubs[index]?.clubId;
    return clubsAll.filter((c) => !chosen.has(c.id) || c.id === current);
  };

  const setClubQuery = (index: number, query: string) => {
    const rows = [...editor.clubs];
    rows[index] = { ...rows[index], clubQuery: query, clubOptions: [] };
    setEditor({ ...editor, clubs: rows });

    const key = `club-${index}`;
    if (searchTimers.current[key]) clearTimeout(searchTimers.current[key]);

    if (query.trim().length >= 2) {
      searchTimers.current[key] = window.setTimeout(() => {
        const available = availableClubsForRow(index);
        const filtered = available
          .filter((c) => {
            const label = `${c.name} ${c.city || ''} ${c.region || ''}`.toLowerCase();
            return label.includes(query.toLowerCase());
          })
          .map((c) => ({
            id: c.id,
            label: `${c.name}${c.city ? ` (${c.city})` : ''}`,
          }));

        const rows = [...editor.clubs];
        rows[index] = { ...rows[index], clubOptions: filtered };
        setEditor({ ...editor, clubs: rows });
      }, 300);
    }
  };

  const chooseClub = (index: number, pick: { id: string; label: string }) => {
    const rows = [...editor.clubs];
    rows[index] = {
      ...rows[index],
      clubId: pick.id,
      club: pick,
      clubQuery: '',
      clubOptions: [],
    };
    setEditor({ ...editor, clubs: rows });
    setEditingClubIdx(null);
  };

  const startEditingClub = (index: number) => {
    const club = editor.clubs[index];
    if (!club?.clubId) return;
    setEditingClubIdx(index);
    const clubLabel = club.club?.label || '';
    if (clubLabel.length >= 2) {
      setClubQuery(index, clubLabel);
    }
  };

  const cancelEditingClub = () => {
    setEditingClubIdx(null);
  };

  const setCaptainQuery = (index: number, query: string) => {
    const rows = [...editor.clubs];
    rows[index] = { ...rows[index], singleQuery: query, singleOptions: [] };
    setEditor({ ...editor, clubs: rows });

    const key = `captain-${index}`;
    if (searchTimers.current[key]) clearTimeout(searchTimers.current[key]);

    if (query.trim().length >= 3) {
      searchTimers.current[key] = window.setTimeout(async () => {
        const opts = await searchPlayers(query.trim());

        // Exclude captains already chosen for other clubs
        const selectedElsewhere = new Set<string>();
        editor.clubs.forEach((crow, idx) => {
          if (idx === index) return;
          if (crow.singleCaptain?.id) selectedElsewhere.add(crow.singleCaptain.id);
        });

        const filtered = opts.filter((o) => !selectedElsewhere.has(o.id));

        const rows = [...editor.clubs];
        rows[index] = { ...rows[index], singleOptions: filtered };
        setEditor({ ...editor, clubs: rows });
      }, 300);
    }
  };

  const chooseCaptain = (index: number, pick: { id: string; label: string }) => {
    const rows = [...editor.clubs];
    rows[index] = {
      ...rows[index],
      singleCaptain: pick,
      singleQuery: '',
      singleOptions: [],
    };
    setEditor({ ...editor, clubs: rows });
  };

  const removeCaptain = (index: number) => {
    const rows = [...editor.clubs];
    rows[index] = {
      ...rows[index],
      singleCaptain: null,
      singleQuery: '',
      singleOptions: [],
    };
    setEditor({ ...editor, clubs: rows });
  };

  const showCaptains = editor.hasCaptains;

  return (
    <div className="space-y-4 max-w-3xl">
      <div>
        <h3 className="text-lg font-semibold text-primary mb-2">
          {showCaptains ? 'Participating Clubs & Captains' : 'Participating Clubs'}
        </h3>
        <p className="text-sm text-muted">
          {showCaptains
            ? 'Add clubs to this tournament and assign a captain for each club who can manage their team roster'
            : 'Add clubs to this tournament'}
        </p>
      </div>

      {/* Global club search input */}
      <div className="relative">
        <input
          type="text"
          className="input w-full"
          placeholder="Type 3+ characters to search and add clubs…"
          value={globalClubQuery}
          onChange={(e) => setGlobalClubQuery(e.target.value)}
        />
        {globalClubOptions.length > 0 && (
          <div className="absolute z-10 w-full mt-1 border border-subtle rounded bg-surface-1 max-h-48 overflow-auto shadow-lg">
            {globalClubOptions.map((opt) => (
              <button
                key={opt.id}
                className="block w-full text-left px-3 py-2 hover:bg-surface-2 text-sm"
                onClick={() => addClubFromGlobalSearch(opt)}
              >
                {opt.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Selected clubs as chips */}
      {editor.clubs.length === 0 ? (
        <div className="card p-6 text-center">
          <p className="text-sm text-muted">No clubs added yet. Search above to add clubs.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {editor.clubs.map((club, index) => {
            const isEditing = editingClubIdx === index;

            return (
              <div key={index} className="flex flex-wrap items-start gap-2">
                {/* Club chip */}
                {!isEditing && club.club?.id ? (
                  <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-primary/10 border border-primary/30 rounded-lg">
                    <span className="text-sm font-medium text-primary">{club.club.label}</span>
                    {showCaptains && club.singleCaptain?.id && (
                      <span className="text-xs text-muted">• {club.singleCaptain.label}</span>
                    )}
                    <button
                      className="ml-1 text-error hover:text-error-hover text-sm"
                      onClick={() => startEditingClub(index)}
                      title="Change club"
                    >
                      ✏️
                    </button>
                    <button
                      className="text-error hover:text-error-hover text-sm"
                      onClick={() => removeClubRow(index)}
                      title="Remove club"
                    >
                      ✕
                    </button>
                  </div>
                ) : isEditing ? (
                  <div className="relative flex-1 min-w-[200px]">
                    <input
                      type="text"
                      className="input w-full"
                      placeholder="Type 2+ chars to search clubs…"
                      value={club.clubQuery || ''}
                      onChange={(e) => setClubQuery(index, e.target.value)}
                      autoFocus
                    />
                    {club.clubOptions && club.clubOptions.length > 0 && (
                      <div className="absolute z-10 w-full mt-1 border border-subtle rounded bg-surface-1 max-h-40 overflow-auto shadow-lg">
                        {club.clubOptions.map((opt) => (
                          <button
                            key={opt.id}
                            className="block w-full text-left px-2 py-1 hover:bg-surface-2 text-sm"
                            onClick={() => chooseClub(index, opt)}
                          >
                            {opt.label}
                          </button>
                        ))}
                      </div>
                    )}
                    <button
                      className="ml-2 text-sm text-muted hover:text-primary"
                      onClick={cancelEditingClub}
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-surface-2 border border-subtle rounded-lg">
                    <span className="text-sm text-muted">Empty slot</span>
                    <button
                      className="text-error hover:text-error-hover text-sm"
                      onClick={() => removeClubRow(index)}
                      title="Remove"
                    >
                      ✕
                    </button>
                  </div>
                )}

                {/* Captain assignment (inline when club is selected) */}
                {showCaptains && club.clubId && !isEditing && (
                  <div className="inline-flex items-center gap-2">
                    {club.singleCaptain?.id ? (
                      <div className="inline-flex items-center gap-1 px-2 py-1 bg-surface-2 border border-subtle rounded text-sm">
                        <span className="text-muted">Captain:</span>
                        <span className="text-primary">{club.singleCaptain.label}</span>
                        <button
                          className="ml-1 text-error hover:text-error-hover text-xs"
                          onClick={() => removeCaptain(index)}
                          title="Remove captain"
                        >
                          ✕
                        </button>
                      </div>
                    ) : (
                      <div className="relative inline-block">
                        <input
                          type="text"
                          className="input text-sm w-48"
                          placeholder="Search captain…"
                          value={club.singleQuery || ''}
                          onChange={(e) => setCaptainQuery(index, e.target.value)}
                        />
                        {club.singleOptions && club.singleOptions.length > 0 && (
                          <div className="absolute z-10 w-full mt-1 border border-subtle rounded bg-surface-1 max-h-40 overflow-auto shadow-lg">
                            {club.singleOptions.map((opt) => (
                              <button
                                key={opt.id}
                                className="block w-full text-left px-2 py-1 hover:bg-surface-2 text-sm"
                                onClick={() => chooseCaptain(index, opt)}
                              >
                                {opt.label}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
