'use client';

import { useState } from 'react';

export type Bracket = {
  id: string;
  name: string;
  gameType?: string; // MENS_DOUBLES, WOMENS_DOUBLES, MIXED_DOUBLES, etc.
  skillLevel?: string; // 3.0, 3.5, 4.0, etc.
};

export type BracketPricing = {
  bracketId: string;
  cost: number; // in cents
};

type PerBracketPricingConfigProps = {
  brackets: Bracket[];
  pricing: BracketPricing[];
  onPricingChange: (pricing: BracketPricing[]) => void;
};

export function PerBracketPricingConfig({
  brackets,
  pricing,
  onPricingChange,
}: PerBracketPricingConfigProps) {
  const [bulkPrice, setBulkPrice] = useState('');
  const [gameTypePrices, setGameTypePrices] = useState<Record<string, string>>({
    MENS_DOUBLES: '',
    WOMENS_DOUBLES: '',
    MIXED_DOUBLES: '',
    MENS_SINGLES: '',
    WOMENS_SINGLES: '',
  });

  // Get price for a specific bracket (in dollars)
  const getBracketPrice = (bracketId: string): string => {
    const bracketPricing = pricing.find((p) => p.bracketId === bracketId);
    if (!bracketPricing || bracketPricing.cost === 0) return '';
    return (bracketPricing.cost / 100).toFixed(2);
  };

  // Update price for a specific bracket
  const updateBracketPrice = (bracketId: string, priceStr: string) => {
    const cleaned = priceStr.replace(/[^\d.]/g, '');
    const price = cleaned === '' ? 0 : Math.round(parseFloat(cleaned) * 100);

    const existingIndex = pricing.findIndex((p) => p.bracketId === bracketId);
    const newPricing = [...pricing];

    if (existingIndex >= 0) {
      newPricing[existingIndex] = { bracketId, cost: price };
    } else {
      newPricing.push({ bracketId, cost: price });
    }

    onPricingChange(newPricing);
  };

  // Apply bulk price to all brackets
  const applyBulkPrice = () => {
    const cleaned = bulkPrice.replace(/[^\d.]/g, '');
    if (cleaned === '') return;

    const price = Math.round(parseFloat(cleaned) * 100);
    const newPricing = brackets.map((bracket) => ({
      bracketId: bracket.id,
      cost: price,
    }));

    onPricingChange(newPricing);
    setBulkPrice('');
  };

  // Apply game type pricing
  const applyGameTypePricing = (gameType: string) => {
    const priceStr = gameTypePrices[gameType];
    const cleaned = priceStr.replace(/[^\d.]/g, '');
    if (cleaned === '') return;

    const price = Math.round(parseFloat(cleaned) * 100);

    // Find all brackets with this game type
    const bracketsToUpdate = brackets.filter((b) => b.gameType === gameType);

    const newPricing = [...pricing];

    bracketsToUpdate.forEach((bracket) => {
      const existingIndex = newPricing.findIndex((p) => p.bracketId === bracket.id);
      if (existingIndex >= 0) {
        newPricing[existingIndex] = { bracketId: bracket.id, cost: price };
      } else {
        newPricing.push({ bracketId: bracket.id, cost: price });
      }
    });

    onPricingChange(newPricing);

    // Clear the input
    setGameTypePrices((prev) => ({ ...prev, [gameType]: '' }));
  };

  // Format currency input
  const formatCurrency = (value: string): string => {
    const cleaned = value.replace(/[^\d.]/g, '');
    const parts = cleaned.split('.');
    if (parts.length > 2) {
      return parts[0] + '.' + parts.slice(1).join('');
    }
    if (parts[1] && parts[1].length > 2) {
      return parts[0] + '.' + parts[1].slice(0, 2);
    }
    return cleaned;
  };

  // Get display name for game type
  const getGameTypeName = (gameType?: string): string => {
    if (!gameType) return '';
    const names: Record<string, string> = {
      MENS_DOUBLES: 'Men\'s Doubles',
      WOMENS_DOUBLES: 'Women\'s Doubles',
      MIXED_DOUBLES: 'Mixed Doubles',
      MIXED_DOUBLES_1: 'Mixed Doubles 1',
      MIXED_DOUBLES_2: 'Mixed Doubles 2',
      MENS_SINGLES: 'Men\'s Singles',
      WOMENS_SINGLES: 'Women\'s Singles',
    };
    return names[gameType] || gameType;
  };

  if (brackets.length === 0) {
    return (
      <div className="p-4 bg-surface-2 border border-border-subtle rounded">
        <p className="text-sm text-muted">
          No brackets configured yet. Add brackets to your tournament before setting per-bracket pricing.
        </p>
      </div>
    );
  }

  // Group brackets by game type
  const bracketsByGameType = brackets.reduce(
    (acc, bracket) => {
      const gameType = bracket.gameType || 'OTHER';
      if (!acc[gameType]) acc[gameType] = [];
      acc[gameType].push(bracket);
      return acc;
    },
    {} as Record<string, Bracket[]>
  );

  return (
    <div className="space-y-4">
      <div>
        <h4 className="text-sm font-semibold text-secondary mb-2">Bracket Pricing Configuration</h4>
        <p className="text-xs text-muted mb-4">
          Set different registration costs for each bracket/game type. Players pay for each bracket they register for.
        </p>
      </div>

      {/* Individual Bracket Pricing */}
      <div className="space-y-4">
        {Object.entries(bracketsByGameType).map(([gameType, gameBrackets]) => (
          <div key={gameType}>
            <div className="text-xs font-semibold text-muted uppercase mb-2">
              {getGameTypeName(gameType)}
            </div>
            <div className="space-y-2">
              {gameBrackets.map((bracket) => (
                <div
                  key={bracket.id}
                  className="flex items-center justify-between p-3 bg-surface-2 border border-border-subtle rounded"
                >
                  <div className="flex-1">
                    <div className="font-medium text-secondary">{bracket.name}</div>
                    {bracket.skillLevel && (
                      <div className="text-xs text-muted">Skill Level: {bracket.skillLevel}</div>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-lg text-secondary">$</span>
                    <input
                      type="text"
                      className="input w-24"
                      value={getBracketPrice(bracket.id)}
                      onChange={(e) => {
                        const formatted = formatCurrency(e.target.value);
                        updateBracketPrice(bracket.id, formatted);
                      }}
                      placeholder="0.00"
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Quick Actions */}
      <div className="border-t border-border-subtle pt-4 space-y-4">
        {/* Bulk All */}
        <div>
          <div className="flex items-center gap-3">
            <label className="text-sm font-medium text-secondary whitespace-nowrap">
              Set all brackets to:
            </label>
            <div className="flex items-center gap-2">
              <span className="text-lg text-secondary">$</span>
              <input
                type="text"
                className="input w-24"
                value={bulkPrice}
                onChange={(e) => setBulkPrice(formatCurrency(e.target.value))}
                placeholder="0.00"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    applyBulkPrice();
                  }
                }}
              />
            </div>
            <button
              className="btn btn-secondary"
              onClick={applyBulkPrice}
              disabled={!bulkPrice.trim()}
            >
              Apply to All
            </button>
          </div>
        </div>

        {/* Game Type Pricing */}
        {Object.keys(bracketsByGameType).length > 1 && (
          <div>
            <div className="text-sm font-medium text-secondary mb-2">
              Set price by game type:
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {Object.entries(bracketsByGameType).map(([gameType, gameBrackets]) => (
                <div key={gameType} className="flex items-center gap-2">
                  <label className="text-xs text-muted whitespace-nowrap flex-shrink-0 w-32">
                    {getGameTypeName(gameType)}:
                  </label>
                  <div className="flex items-center gap-2 flex-1">
                    <span className="text-sm text-secondary">$</span>
                    <input
                      type="text"
                      className="input w-20 text-sm"
                      value={gameTypePrices[gameType] || ''}
                      onChange={(e) =>
                        setGameTypePrices((prev) => ({
                          ...prev,
                          [gameType]: formatCurrency(e.target.value),
                        }))
                      }
                      placeholder="0.00"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          applyGameTypePricing(gameType);
                        }
                      }}
                    />
                    <button
                      className="btn btn-secondary text-xs px-2 py-1"
                      onClick={() => applyGameTypePricing(gameType)}
                      disabled={!gameTypePrices[gameType]?.trim()}
                    >
                      Apply
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Summary */}
      <div className="border-t border-border-subtle pt-4">
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted">Total if player registers for all brackets:</span>
          <span className="font-semibold text-primary">
            $
            {(
              pricing.reduce((sum, p) => sum + p.cost, 0) / 100
            ).toFixed(2)}
          </span>
        </div>
      </div>
    </div>
  );
}
