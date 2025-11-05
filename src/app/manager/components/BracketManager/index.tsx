'use client';

/**
 * Bracket Manager Component
 *
 * Main manager for bracket-style tournaments (Double Elimination, Single Elimination).
 * Handles bracket setup, match management, and score entry.
 */

import { useState, useEffect } from 'react';
import { BracketSetup } from '../BracketSetup';
import { BracketMatchManager } from '../BracketMatchManager';
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
  const [availableClubs, setAvailableClubs] = useState<Array<{ id: string; name: string }>>([]);
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
        const clubs: Array<{ id: string; name: string }> = [];

        for (const club of data.clubs || []) {
          // Add club to clubs list
          clubs.push({
            id: club.clubId,
            name: club.clubName,
          });

          // Extract teams for each bracket
          for (const bracket of club.brackets || []) {
            teams.push({
              id: bracket.teamId,
              name: `${club.clubName}${bracket.bracketName && bracket.bracketName !== 'DEFAULT' ? ` ${bracket.bracketName}` : ''}`,
              clubId: club.clubId,
            });
          }
        }

        setAvailableTeams(teams);
        setAvailableClubs(clubs);

        // Check if bracket already exists by using lightweight endpoint
        // Don't rely on tournament.stops because it may have stale data
        try {
          const scheduleResponse = await fetch(`/api/admin/stops/${tournament.stops[0]?.stopId}/has-bracket`);
          if (scheduleResponse.ok) {
            const { hasBracket } = await scheduleResponse.json();
            setHasBracket(hasBracket);
          } else {
            setHasBracket(false);
          }
        } catch (err) {
          // If we can't fetch, assume no bracket
          setHasBracket(false);
        }
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
          tournamentType={tournament.type}
          stopId={tournament.stops[0]?.stopId}
          availableTeams={availableTeams}
          availableClubs={availableClubs}
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

  // Show bracket match management
  return <BracketMatchManager tournament={tournament} stopId={tournament.stops[0]?.stopId} onError={onError} onInfo={onInfo} />;
}
