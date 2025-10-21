'use client';

import type { EditorRow, NewBracket } from '../TournamentEditor';

type BracketsTabProps = {
  editor: EditorRow;
  setEditor: (editor: EditorRow) => void;
};

export function BracketsTab({ editor, setEditor }: BracketsTabProps) {
  const addBracket = () => {
    const id = (globalThis.crypto ?? window.crypto).randomUUID();
    setEditor({
      ...editor,
      brackets: [...editor.brackets, { id, name: '' }],
    });
  };

  const updateBracketName = (bracketId: string, name: string) => {
    const next = editor.brackets.map((b) => (b.id === bracketId ? { ...b, name } : b));
    setEditor({ ...editor, brackets: next });
  };

  const removeBracket = (bracketId: string) => {
    const next = editor.brackets.filter((b) => b.id !== bracketId);
    setEditor({ ...editor, brackets: next });
  };

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h3 className="text-lg font-semibold text-primary mb-2">Tournament Brackets</h3>
        <p className="text-sm text-muted">
          Create skill-level brackets to organize players by ability (e.g., Beginner, Intermediate, Advanced, Pro)
        </p>
      </div>

      {editor.brackets.length === 0 ? (
        <div className="card p-8 text-center">
          <div className="text-4xl mb-3">🏅</div>
          <h4 className="font-semibold text-secondary mb-2">No Brackets Created</h4>
          <p className="text-sm text-muted mb-4">
            Add brackets to separate players by skill level or division
          </p>
          <button className="btn btn-primary" onClick={addBracket}>
            + Add First Bracket
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="space-y-3">
            {editor.brackets.map((bracket, index) => (
              <div
                key={bracket.id}
                className="flex items-center gap-3 p-4 border-2 border-border-medium rounded-lg bg-surface-1"
              >
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                  <span className="text-sm font-semibold text-primary">{index + 1}</span>
                </div>

                <input
                  type="text"
                  className="input flex-1"
                  value={bracket.name}
                  onChange={(e) => updateBracketName(bracket.id, e.target.value)}
                  placeholder={`e.g., ${
                    index === 0
                      ? 'Beginner'
                      : index === 1
                      ? 'Intermediate'
                      : index === 2
                      ? 'Advanced'
                      : index === 3
                      ? 'Pro'
                      : `Bracket ${index + 1}`
                  }`}
                />

                <button
                  className="text-error hover:text-error-hover p-2"
                  onClick={() => removeBracket(bracket.id)}
                  aria-label="Remove bracket"
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                    <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                  </svg>
                </button>
              </div>
            ))}
          </div>

          <button className="btn btn-secondary" onClick={addBracket}>
            + Add Bracket
          </button>
        </div>
      )}

      <div className="bg-surface-2 border border-border-subtle rounded p-4">
        <h4 className="font-semibold text-secondary mb-2 flex items-center gap-2">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2"/>
            <path d="M12 16v-4M12 8h.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
          </svg>
          About Brackets
        </h4>
        <ul className="text-sm text-muted space-y-1">
          <li>• Players will be assigned to brackets based on their skill level</li>
          <li>• Each bracket will have its own schedule and standings</li>
          <li>• Bracket names should be clear and descriptive</li>
          <li>• Common bracket names: Beginner, Intermediate, Advanced, Pro, Open</li>
        </ul>
      </div>
    </div>
  );
}
