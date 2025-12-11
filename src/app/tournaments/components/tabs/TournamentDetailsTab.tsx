'use client';

import type { EditorRow, TournamentTypeLabel } from '../TournamentEditor';
import { allowsMultipleStops } from '@/lib/tournamentTypeConfig';

type TournamentDetailsTabProps = {
  editor: EditorRow;
  setEditor: (editor: EditorRow) => void;
};

export function TournamentDetailsTab({ editor, setEditor }: TournamentDetailsTabProps) {
  const updateField = <K extends keyof EditorRow>(field: K, value: EditorRow[K]) => {
    setEditor({ ...editor, [field]: value });
  };

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h3 className="text-lg font-semibold text-primary mb-4">Basic Information</h3>

        <div className="space-y-4">
          <div>
            <label htmlFor="tournament-name" className="block text-sm font-semibold text-secondary mb-2">
              Tournament Name <span className="text-error">*</span>
            </label>
            <input
              id="tournament-name"
              type="text"
              className="input w-full"
              value={editor.name}
              onChange={(e) => updateField('name', e.target.value)}
              placeholder="e.g., Summer Championship 2025"
            />
          </div>

          <div>
            <label htmlFor="tournament-type" className="block text-sm font-semibold text-secondary mb-2">
              Tournament Type <span className="text-error">*</span>
            </label>
            <select
              id="tournament-type"
              className="input w-full"
              value={editor.type}
              onChange={(e) => updateField('type', e.target.value as TournamentTypeLabel)}
            >
              <option value="Club Round-Robin">Club Round-Robin</option>
              <option value="Club Double Elimination">Club Double Elimination</option>
              <option value="Single Elimination">Single Elimination</option>
              <option value="Double Elimination">Double Elimination</option>
              <option value="Round Robin">Round Robin</option>
              <option value="Pool Play">Pool Play</option>
              <option value="Ladder Tournament">Ladder Tournament</option>
            </select>
            <p className="text-xs text-muted mt-1">
              Changing this may affect available options in other tabs
            </p>
          </div>

          <div>
            <label htmlFor="max-team-size" className="block text-sm font-semibold text-secondary mb-2">
              {editor.hasBrackets ? 'Max Bracket Size' : 'Max Team Size'}
            </label>
            <input
              id="max-team-size"
              type="text"
              className="input w-full"
              value={editor.maxTeamSize}
              onChange={(e) => updateField('maxTeamSize', e.target.value)}
              placeholder="Leave blank for unlimited"
            />
            <p className="text-xs text-muted mt-1">
              {editor.hasBrackets
                ? 'Maximum number of players allowed in each bracket. Leave blank for unlimited.'
                : 'Maximum number of players per team. Leave blank for unlimited.'}
            </p>
          </div>
        </div>
      </div>

      <div className="border-t border-border-subtle pt-6">
        <h3 className="text-lg font-semibold text-primary mb-4">Configuration Options</h3>

        <div className="space-y-3">
          {/* Hide Multiple Stops for tournaments that don't allow multiple stops */}
          {allowsMultipleStops(editor.type) && (
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                className="mt-1"
                checked={editor.hasMultipleStops}
                onChange={(e) => updateField('hasMultipleStops', e.target.checked)}
              />
              <div>
                <div className="font-medium text-secondary">Multiple Stops</div>
                <p className="text-xs text-muted">
                  Enable if this tournament has multiple locations or rounds (e.g., regional qualifiers, finals)
                </p>
              </div>
            </label>
          )}

          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              className="mt-1"
              checked={editor.hasBrackets}
              onChange={(e) => updateField('hasBrackets', e.target.checked)}
            />
            <div>
              <div className="font-medium text-secondary">Enable Brackets</div>
              <p className="text-xs text-muted">
                Create skill-level brackets (e.g., Beginner, Intermediate, Advanced, Pro)
              </p>
            </div>
          </label>

          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              className="mt-1"
              checked={editor.hasCaptains}
              onChange={(e) => updateField('hasCaptains', e.target.checked)}
            />
            <div>
              <div className="font-medium text-secondary">Enable Captains</div>
              <p className="text-xs text-muted">
                Assign team captains who can manage their club's roster
              </p>
            </div>
          </label>
        </div>
      </div>

      {/* Bracket Tournament Settings - Only show for bracket tournament types */}
      {(editor.type === 'Double Elimination' || editor.type === 'Club Double Elimination' || editor.type === 'Single Elimination') && (
        <div className="border-t border-border-subtle pt-6">
          <h3 className="text-lg font-semibold text-primary mb-4">Match Settings</h3>

          <div className="space-y-4">
            {/* Games Per Match */}
            <div>
              <label htmlFor="games-per-match" className="block text-sm font-semibold text-secondary mb-2">
                Games Per Match
              </label>
              <input
                id="games-per-match"
                type="number"
                min="1"
                max="4"
                className="input w-full"
                value={editor.gamesPerMatch}
                onChange={(e) => updateField('gamesPerMatch', parseInt(e.target.value, 10) || 3)}
              />
              <p className="text-xs text-muted mt-1">
                Number of games played in each match (typically 3-4)
              </p>
            </div>

            {/* Game Slots */}
            <div>
              <label className="block text-sm font-semibold text-secondary mb-2">
                Game Slots
              </label>
              <div className="space-y-2">
                {[
                  { value: 'MENS_DOUBLES', label: "Men's Doubles" },
                  { value: 'WOMENS_DOUBLES', label: "Women's Doubles" },
                  { value: 'MIXED_1', label: 'Mixed 1' },
                  { value: 'MIXED_2', label: 'Mixed 2' },
                ].map(slot => (
                  <label key={slot.value} className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={editor.gameSlots.includes(slot.value)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          updateField('gameSlots', [...editor.gameSlots, slot.value]);
                        } else {
                          updateField('gameSlots', editor.gameSlots.filter(s => s !== slot.value));
                        }
                      }}
                      className="w-4 h-4"
                    />
                    <span className="text-sm text-secondary">{slot.label}</span>
                  </label>
                ))}
              </div>
              <p className="text-xs text-muted mt-2">
                Select which game types will be played in each match
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="bg-surface-2 border border-border-subtle rounded p-4">
        <h4 className="font-semibold text-secondary mb-2 flex items-center gap-2">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2"/>
            <path d="M12 16v-4M12 8h.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
          </svg>
          Current Configuration
        </h4>
        <ul className="text-sm text-muted space-y-1">
          <li>• Type: <span className="font-medium text-secondary">{editor.type}</span></li>
          <li>• Stops: <span className="font-medium text-secondary">{editor.hasMultipleStops ? 'Multiple' : 'Single'}</span></li>
          <li>• Brackets: <span className="font-medium text-secondary">{editor.hasBrackets ? 'Enabled' : 'Disabled'}</span></li>
          <li>• Captains: <span className="font-medium text-secondary">{editor.hasCaptains ? 'Enabled' : 'Disabled'}</span></li>
          <li>• Team Size Limit: <span className="font-medium text-secondary">{editor.maxTeamSize || 'Unlimited'}</span></li>
          {(editor.type === 'Double Elimination' || editor.type === 'Club Double Elimination' || editor.type === 'Single Elimination') && (
            <>
              <li>• Games Per Match: <span className="font-medium text-secondary">{editor.gamesPerMatch}</span></li>
              <li>• Game Slots: <span className="font-medium text-secondary">{editor.gameSlots.length} selected</span></li>
            </>
          )}
        </ul>
      </div>
    </div>
  );
}
