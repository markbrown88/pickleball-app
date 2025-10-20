'use client';

/**
 * Bracket Manager Component
 *
 * Main manager for bracket-style tournaments (Double Elimination, Single Elimination).
 * Handles bracket setup, match management, and score entry.
 */

import { useState, useEffect } from 'react';
import { BracketSetup } from '../BracketSetup';
import { EventManagerTournament } from '../ManagerRouter';

interface BracketManagerProps {
  tournaments: EventManagerTournament[];
  onError: (message: string) => void;
  onInfo: (message: string) => void;
}

interface Team {
  id: string;
  name: string;
  clubId?: string;
}

export function BracketManager({ tournaments, onError, onInfo }: BracketManagerProps) {
  const tournament = tournaments[0];
  const [availableTeams, setAvailableTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasBracket, setHasBracket] = useState(false);

  // Load tournament teams
  useEffect(() => {
    if (!tournament) return;

    async function loadTeams() {
      try {
        setLoading(true);

        // Fetch teams for this tournament
        const response = await fetch(`/api/admin/tournaments/${tournament.tournamentId}/teams`);
        if (!response.ok) {
          throw new Error('Failed to load teams');
        }

        const data = await response.json();

        // Extract teams from the clubs/brackets structure
        const teams: Team[] = [];
        for (const club of data.clubs || []) {
          for (const bracket of club.brackets || []) {
            teams.push({
              id: bracket.teamId,
              name: `${club.clubName}${bracket.bracketName && bracket.bracketName !== 'DEFAULT' ? ` ${bracket.bracketName}` : ''}`,
              clubId: club.clubId,
            });
          }
        }

        setAvailableTeams(teams);

        // Check if bracket already exists
        const hasRounds = tournament.stops.some(stop => stop.rounds.length > 0);
        setHasBracket(hasRounds);
      } catch (error) {
        console.error('Error loading teams:', error);
        onError(error instanceof Error ? error.message : 'Failed to load teams');
      } finally {
        setLoading(false);
      }
    }

    loadTeams();
  }, [tournament?.tournamentId]);

  if (loading) {
    return (
      <div className="card p-8 flex items-center justify-center gap-3">
        <div className="loading-spinner" />
        <span className="text-muted">Loading bracket manager...</span>
      </div>
    );
  }

  if (!tournament) {
    return (
      <div className="card p-8 text-center">
        <div className="max-w-md mx-auto space-y-3">
          <div className="text-5xl">❓</div>
          <h3 className="text-lg font-semibold text-secondary">No Tournament Selected</h3>
          <p className="text-muted">Please select a tournament to manage.</p>
        </div>
      </div>
    );
  }

  // Show bracket setup if no bracket exists yet
  if (!hasBracket) {
    return (
      <div className="space-y-6">
        <BracketSetup
          tournamentId={tournament.tournamentId}
          stopId={tournament.stops[0]?.stopId}
          availableTeams={availableTeams}
          onGenerate={() => {
            setHasBracket(true);
            onInfo('Bracket generated successfully! Refreshing...');
            // Reload page to show the bracket
            window.location.reload();
          }}
          onError={onError}
          onSuccess={onInfo}
        />
      </div>
    );
  }

  // TODO: Show bracket visualization and match management
  return (
    <div className="card p-8 text-center">
      <div className="max-w-md mx-auto space-y-3">
        <div className="text-5xl">🏆</div>
        <h3 className="text-lg font-semibold text-secondary">Bracket Management</h3>
        <p className="text-muted">
          Bracket has been generated! Match management interface coming in Sprint 4.
        </p>
        <div className="mt-4 text-sm text-gray-400">
          <p>Tournament: {tournament.tournamentName}</p>
          <p>Type: {tournament.type}</p>
          <p>Rounds: {tournament.stops[0]?.rounds.length || 0}</p>
        </div>
      </div>
    </div>
  );
}
