'use client';

import { useState } from 'react';
import { formatDateRangeUTC } from '@/lib/utils';

export type Stop = {
  id: string;
  name: string;
  startAt: Date;
};

export type StopPricing = {
  stopId: string;
  cost: number; // in cents
};

type PerStopPricingConfigProps = {
  stops: Stop[];
  pricing: StopPricing[];
  onPricingChange: (pricing: StopPricing[]) => void;
};

export function PerStopPricingConfig({ stops, pricing, onPricingChange }: PerStopPricingConfigProps) {
  const [bulkPrice, setBulkPrice] = useState('');

  // Get price for a specific stop (in dollars)
  const getStopPrice = (stopId: string): string => {
    const stopPricing = pricing.find((p) => p.stopId === stopId);
    if (!stopPricing || stopPricing.cost === 0) return '';
    return (stopPricing.cost / 100).toFixed(2);
  };

  // Update price for a specific stop
  const updateStopPrice = (stopId: string, priceStr: string) => {
    const cleaned = priceStr.replace(/[^\d.]/g, '');
    const price = cleaned === '' ? 0 : Math.round(parseFloat(cleaned) * 100);

    const existingIndex = pricing.findIndex((p) => p.stopId === stopId);
    const newPricing = [...pricing];

    if (existingIndex >= 0) {
      newPricing[existingIndex] = { stopId, cost: price };
    } else {
      newPricing.push({ stopId, cost: price });
    }

    onPricingChange(newPricing);
  };

  // Apply bulk price to all stops
  const applyBulkPrice = () => {
    const cleaned = bulkPrice.replace(/[^\d.]/g, '');
    if (cleaned === '') return;

    const price = Math.round(parseFloat(cleaned) * 100);
    const newPricing = stops.map((stop) => ({
      stopId: stop.id,
      cost: price,
    }));

    onPricingChange(newPricing);
    setBulkPrice('');
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


  if (stops.length === 0) {
    return (
      <div className="p-4 bg-surface-2 border border-border-subtle rounded">
        <p className="text-sm text-muted">
          No stops configured yet. Add stops to your tournament before setting per-stop pricing.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h4 className="text-sm font-semibold text-secondary mb-2">Stop Pricing Configuration</h4>
        <p className="text-xs text-muted mb-4">
          Set the registration cost for each stop. Players will pay for each stop they register for.
        </p>
      </div>

      {/* Individual Stop Pricing */}
      <div className="space-y-3">
        {stops.map((stop) => (
          <div
            key={stop.id}
            className="flex items-center justify-between p-3 bg-surface-2 border border-border-subtle rounded"
          >
            <div className="flex-1">
              <div className="font-medium text-secondary">{stop.name}</div>
              <div className="text-xs text-muted">
                {formatDateRangeUTC(
                  stop.startAt instanceof Date ? stop.startAt.toISOString() : stop.startAt,
                  (stop as any).endAt instanceof Date ? (stop as any).endAt.toISOString() : (stop as any).endAt || null
                )}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-lg text-secondary">$</span>
              <input
                type="text"
                className="input w-24"
                value={getStopPrice(stop.id)}
                onChange={(e) => {
                  const formatted = formatCurrency(e.target.value);
                  updateStopPrice(stop.id, formatted);
                }}
                placeholder="0.00"
              />
            </div>
          </div>
        ))}
      </div>

      {/* Bulk Action */}
      <div className="border-t border-border-subtle pt-4">
        <div className="flex items-center gap-3">
          <label className="text-sm font-medium text-secondary whitespace-nowrap">
            Set all stops to:
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
        <p className="text-xs text-muted mt-2">
          Quick action: Set the same price for all stops at once
        </p>
      </div>

      {/* Summary */}
      <div className="border-t border-border-subtle pt-4">
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted">Total if player registers for all stops:</span>
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
