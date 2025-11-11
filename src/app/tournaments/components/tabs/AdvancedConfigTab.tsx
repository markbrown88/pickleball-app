'use client';

import { useState, useEffect } from 'react';
import { PerStopPricingConfig, type Stop, type StopPricing } from './PerStopPricingConfig';
import { PerBracketPricingConfig, type Bracket, type BracketPricing } from './PerBracketPricingConfig';
import { GameTypeConfigGrid, type BracketGameTypeConfig } from './GameTypeConfigGrid';
import { CapacityManagementConfig, type StopBracketCapacity, type Club } from './CapacityManagementConfig';

type AdvancedConfigTabProps = {
  tournamentId: string;
  pricingModel: 'TOURNAMENT_WIDE' | 'PER_STOP' | 'PER_BRACKET' | 'PER_STOP_PER_BRACKET';
  isTeamTournament: boolean;
};

export function AdvancedConfigTab({
  tournamentId,
  pricingModel,
  isTeamTournament,
}: AdvancedConfigTabProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Data from API
  const [stops, setStops] = useState<Stop[]>([]);
  const [brackets, setBrackets] = useState<Bracket[]>([]);
  const [clubs, setClubs] = useState<Club[]>([]);

  // Configuration state
  const [stopPricing, setStopPricing] = useState<StopPricing[]>([]);
  const [bracketPricing, setBracketPricing] = useState<BracketPricing[]>([]);
  const [gameTypeConfig, setGameTypeConfig] = useState<BracketGameTypeConfig[]>([]);
  const [capacities, setCapacities] = useState<StopBracketCapacity[]>([]);

  // Fetch data on mount
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        setError(null);

        const response = await fetch(`/api/admin/tournaments/${tournamentId}/config/full`);
        if (!response.ok) {
          throw new Error('Failed to load tournament configuration');
        }

        const data = await response.json();

        // Set basic data
        setStops(
          data.stops.map((s: any) => ({
            id: s.id,
            name: s.name,
            startAt: new Date(s.startAt),
          }))
        );

        setBrackets(
          data.brackets.map((b: any) => ({
            id: b.id,
            name: b.name,
            gameType: b.gameType,
            skillLevel: b.skillLevel,
          }))
        );

        setClubs(
          data.clubs.map((c: any) => ({
            id: c.club.id,
            name: c.club.name,
          }))
        );

        // Set configuration
        setStopPricing(data.pricing.stopPricing || []);
        setBracketPricing(data.pricing.bracketPricing || []);
        setGameTypeConfig(data.gameTypeConfig || []);
        setCapacities(data.capacities || []);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [tournamentId]);

  // Save pricing configuration
  const savePricing = async () => {
    try {
      setSaving(true);
      setError(null);

      const response = await fetch(`/api/admin/tournaments/${tournamentId}/config/pricing`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          stopPricing,
          bracketPricing,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to save pricing configuration');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
      throw err;
    } finally {
      setSaving(false);
    }
  };

  // Save game type configuration
  const saveGameTypes = async () => {
    try {
      setSaving(true);
      setError(null);

      const response = await fetch(`/api/admin/tournaments/${tournamentId}/config/game-types`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          config: gameTypeConfig,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to save game type configuration');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
      throw err;
    } finally {
      setSaving(false);
    }
  };

  // Save capacity configuration
  const saveCapacities = async () => {
    try {
      setSaving(true);
      setError(null);

      const response = await fetch(`/api/admin/tournaments/${tournamentId}/config/capacity`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          capacities: capacities.filter((c) => c.maxCapacity > 0), // Only send non-zero capacities
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to save capacity configuration');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
      throw err;
    } finally {
      setSaving(false);
    }
  };

  // Save all configurations
  const saveAll = async () => {
    try {
      await Promise.all([savePricing(), saveGameTypes(), saveCapacities()]);
      // Success message could be shown here
      alert('Configuration saved successfully!');
    } catch (err) {
      // Error already set in individual save functions
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full mx-auto mb-4"></div>
          <p className="text-sm text-muted">Loading configuration...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="border border-error bg-error/10 text-error p-4 rounded">
        <p className="font-semibold mb-2">Error loading configuration</p>
        <p className="text-sm">{error}</p>
      </div>
    );
  }

  const showStopPricing = pricingModel === 'PER_STOP' || pricingModel === 'PER_STOP_PER_BRACKET';
  const showBracketPricing = pricingModel === 'PER_BRACKET' || pricingModel === 'PER_STOP_PER_BRACKET';

  return (
    <div className="space-y-8 max-w-6xl">
      <div>
        <h3 className="text-lg font-semibold text-primary mb-2">Advanced Configuration</h3>
        <p className="text-sm text-muted">
          Configure detailed pricing, game types, and capacity limits for your tournament.
          All changes are saved automatically when you click "Save All Changes" at the bottom.
        </p>
      </div>

      {error && (
        <div className="border border-error bg-error/10 text-error p-3 rounded">
          {error}
        </div>
      )}

      {/* Pricing Configuration */}
      {(showStopPricing || showBracketPricing) && (
        <div className="border border-border-subtle rounded p-6 bg-surface-1">
          <h4 className="text-md font-semibold text-primary mb-4">Pricing Configuration</h4>

          {showStopPricing && (
            <div className="mb-6">
              <PerStopPricingConfig
                stops={stops}
                pricing={stopPricing}
                onPricingChange={setStopPricing}
              />
            </div>
          )}

          {showBracketPricing && (
            <div>
              <PerBracketPricingConfig
                brackets={brackets}
                pricing={bracketPricing}
                onPricingChange={setBracketPricing}
              />
            </div>
          )}
        </div>
      )}

      {/* Game Type Configuration */}
      <div className="border border-border-subtle rounded p-6 bg-surface-1">
        <h4 className="text-md font-semibold text-primary mb-4">Game Type Configuration</h4>
        <GameTypeConfigGrid
          brackets={brackets}
          config={gameTypeConfig}
          onConfigChange={setGameTypeConfig}
          isTeamTournament={isTeamTournament}
        />
      </div>

      {/* Capacity Management */}
      <div className="border border-border-subtle rounded p-6 bg-surface-1">
        <h4 className="text-md font-semibold text-primary mb-4">Capacity Management</h4>
        <CapacityManagementConfig
          stops={stops}
          brackets={brackets}
          clubs={clubs}
          capacities={capacities}
          onCapacitiesChange={setCapacities}
          isTeamTournament={isTeamTournament}
        />
      </div>

      {/* Save Actions */}
      <div className="border-t border-border-subtle pt-6 flex justify-between items-center">
        <p className="text-sm text-muted">
          Make sure to save your changes before navigating away from this tab.
        </p>
        <div className="flex gap-3">
          <button
            className="btn btn-secondary"
            onClick={() => window.location.reload()}
            disabled={saving}
          >
            Reset Changes
          </button>
          <button className="btn btn-primary" onClick={saveAll} disabled={saving}>
            {saving ? 'Saving...' : 'Save All Changes'}
          </button>
        </div>
      </div>
    </div>
  );
}
