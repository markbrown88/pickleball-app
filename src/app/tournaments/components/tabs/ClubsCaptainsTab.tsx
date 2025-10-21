'use client';

import { useRef } from 'react';
import type { EditorRow, Club, ClubWithCaptain, CaptainPick } from '../TournamentEditor';

type ClubsCaptainsTabProps = {
  editor: EditorRow;
  setEditor: (editor: EditorRow) => void;
  clubsAll: Club[];
  searchPlayers: (term: string) => Promise<Array<{ id: string; label: string }>>;
};

export function ClubsCaptainsTab({ editor, setEditor, clubsAll, searchPlayers }: ClubsCaptainsTabProps) {
  const searchTimers = useRef<Record<string, number>>({});

  const addClubRow = () => {
    setEditor({
      ...editor,
      clubs: [
        ...editor.clubs,
        {
          clubId: undefined,
          singleCaptain: null,
          singleQuery: '',
          singleOptions: [],
          club: null,
          clubQuery: '',
          clubOptions: [],
        },
      ],
    });
  };

  const removeClubRow = (index: number) => {
    const next = [...editor.clubs];
    next.splice(index, 1);
    setEditor({ ...editor, clubs: next });
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
  };

  const removeClub = (index: number) => {
    const rows = [...editor.clubs];
    rows[index] = {
      ...rows[index],
      clubId: undefined,
      club: null,
      clubQuery: '',
      clubOptions: [],
    };
    setEditor({ ...editor, clubs: rows });
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
    <div className="space-y-6 max-w-3xl">
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

      {editor.clubs.length === 0 ? (
        <div className="card p-8 text-center">
          <div className="text-4xl mb-3">🏢</div>
          <h4 className="font-semibold text-secondary mb-2">No Clubs Added</h4>
          <p className="text-sm text-muted mb-4">
            Add clubs to allow teams to participate in this tournament
          </p>
          <button className="btn btn-primary" onClick={addClubRow}>
            + Add First Club
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {editor.clubs.map((club, index) => (
            <div key={index} className="border-2 border-border-medium rounded-lg p-6 space-y-4 bg-surface-1">
              <div className="flex items-center justify-between">
                <h4 className="font-semibold text-secondary">Club {index + 1}</h4>
                <button
                  className="text-error hover:text-error-hover text-sm"
                  onClick={() => removeClubRow(index)}
                >
                  Remove Club
                </button>
              </div>

              <div>
                {club.club ? (
                  <div className="flex items-center gap-2">
                    <span className="chip chip-info">{club.club.label}</span>
                    <button
                      className="text-error hover:text-error-hover text-sm"
                      onClick={() => removeClub(index)}
                    >
                      Change
                    </button>
                  </div>
                ) : (
                  <div className="relative">
                    <input
                      type="text"
                      className="input w-full"
                      value={club.clubQuery || ''}
                      onChange={(e) => setClubQuery(index, e.target.value)}
                      placeholder="Type 2+ characters to search clubs..."
                    />
                    {club.clubOptions && club.clubOptions.length > 0 && (
                      <div className="absolute z-10 w-full mt-1 border border-subtle rounded bg-surface-1 max-h-48 overflow-auto shadow-lg">
                        {club.clubOptions.map((opt) => (
                          <button
                            key={opt.id}
                            className="block w-full text-left px-3 py-2 hover:bg-surface-2 text-sm"
                            onClick={() => chooseClub(index, opt)}
                          >
                            {opt.label}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {showCaptains && (
                <div>
                  <label className="block text-sm font-semibold text-secondary mb-2">
                    Team Captain
                  </label>
                  {club.singleCaptain ? (
                    <div className="flex items-center gap-2">
                      <span className="chip chip-success">{club.singleCaptain.label}</span>
                      <button
                        className="text-error hover:text-error-hover text-sm"
                        onClick={() => removeCaptain(index)}
                      >
                        Remove
                      </button>
                    </div>
                  ) : (
                    <div className="relative">
                      <input
                        type="text"
                        className="input w-full"
                        value={club.singleQuery || ''}
                        onChange={(e) => setCaptainQuery(index, e.target.value)}
                        placeholder="Type 3+ characters to search players..."
                      />
                      {club.singleOptions && club.singleOptions.length > 0 && (
                        <div className="absolute z-10 w-full mt-1 border border-subtle rounded bg-surface-1 max-h-48 overflow-auto shadow-lg">
                          {club.singleOptions.map((opt) => (
                            <button
                              key={opt.id}
                              className="block w-full text-left px-3 py-2 hover:bg-surface-2 text-sm"
                              onClick={() => chooseCaptain(index, opt)}
                            >
                              {opt.label}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                  <p className="text-xs text-muted mt-1">
                    Captain can view and manage their club's roster for this tournament
                  </p>
                </div>
              )}
            </div>
          ))}

          <button className="btn btn-secondary" onClick={addClubRow}>
            + Add Club
          </button>
        </div>
      )}
    </div>
  );
}
