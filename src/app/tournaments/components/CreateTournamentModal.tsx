'use client';

import { useState } from 'react';

type TournamentTypeLabel =
  | 'Team Format'
  | 'Single Elimination'
  | 'Double Elimination'
  | 'Round Robin'
  | 'Pool Play'
  | 'Ladder Tournament';

type CreateTournamentModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onCreate: (data: { name: string; type: TournamentTypeLabel }) => Promise<void>;
};

export function CreateTournamentModal({ isOpen, onClose, onCreate }: CreateTournamentModalProps) {
  const [name, setName] = useState('');
  const [type, setType] = useState<TournamentTypeLabel>('Team Format');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim()) {
      setError('Tournament name is required');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      await onCreate({ name: name.trim(), type });
      setName('');
      setType('Team Format');
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create tournament');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    if (!loading) {
      setName('');
      setType('Team Format');
      setError(null);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={handleClose}>
      <div className="bg-surface-1 rounded-lg shadow-xl max-w-md w-full mx-4" onClick={(e) => e.stopPropagation()}>
        <div className="px-6 py-4 border-b border-border-subtle">
          <h2 className="text-xl font-bold text-primary">Create New Tournament</h2>
          <p className="text-sm text-muted mt-1">Enter basic details to get started</p>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-4 space-y-4">
          {error && (
            <div className="border border-error bg-error/10 text-error p-3 rounded text-sm">
              {error}
            </div>
          )}

          <div>
            <label htmlFor="tournament-name" className="block text-sm font-semibold text-secondary mb-2">
              Tournament Name <span className="text-error">*</span>
            </label>
            <input
              id="tournament-name"
              type="text"
              className="input w-full"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Summer Championship 2025"
              autoFocus
              disabled={loading}
            />
          </div>

          <div>
            <label htmlFor="tournament-type" className="block text-sm font-semibold text-secondary mb-2">
              Tournament Type <span className="text-error">*</span>
            </label>
            <select
              id="tournament-type"
              className="input w-full"
              value={type}
              onChange={(e) => setType(e.target.value as TournamentTypeLabel)}
              disabled={loading}
            >
              <option value="Team Format">Team Format</option>
              <option value="Single Elimination">Single Elimination</option>
              <option value="Double Elimination">Double Elimination</option>
              <option value="Round Robin">Round Robin</option>
              <option value="Pool Play">Pool Play</option>
              <option value="Ladder Tournament">Ladder Tournament</option>
            </select>
            <p className="text-xs text-muted mt-1">
              This determines available options and configuration flow
            </p>
          </div>
        </form>

        <div className="px-6 py-4 border-t border-border-subtle flex justify-end gap-3">
          <button
            type="button"
            className="btn btn-ghost"
            onClick={handleClose}
            disabled={loading}
          >
            Cancel
          </button>
          <button
            type="submit"
            className="btn btn-primary"
            onClick={handleSubmit}
            disabled={loading || !name.trim()}
          >
            {loading ? 'Creating...' : 'Create & Configure'}
          </button>
        </div>
      </div>
    </div>
  );
}
