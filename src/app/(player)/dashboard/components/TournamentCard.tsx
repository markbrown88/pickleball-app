'use client';

import Link from 'next/link';
import { formatDateRangeUTC } from '@/lib/utils';

type TournamentStatus = 'OPEN' | 'INVITE_ONLY' | 'CLOSED';
type RegistrationType = 'FREE' | 'PAID';

export type TournamentCardData = {
  id: string;
  name: string;
  type: string;
  startDate: string | null;
  endDate: string | null;
  location: string | null;
  registrationStatus: TournamentStatus;
  registrationType: RegistrationType;
  registrationCost: number | null;
  maxPlayers: number | null;
  restrictionNotes: string[];
  isWaitlistEnabled: boolean;
  registeredCount: number;
  stops: Array<{
    id: string;
    name: string;
    startAt: string | null;
    endAt: string | null;
    locationName: string | null;
  }>;
};

type TournamentCardProps = {
  tournament: TournamentCardData;
  playerRegistrationStatus?: 'REGISTERED' | 'WITHDRAWN' | 'REJECTED' | 'PENDING_INVITE' | 'WAITLISTED' | null;
  registeredStopIds?: string[]; // Array of stop IDs the player has registered for
  paymentStatus?: 'PAID' | 'PENDING' | 'FAILED' | 'COMPLETED' | 'REFUNDED' | null;
  registrationId?: string; // Registration ID for payment completion link
  onRegister?: (tournamentId: string) => void;
  onRequestInvite?: (tournamentId: string) => void;
  onJoinWaitlist?: (tournamentId: string) => void;
};

function getStatusBadge(status: TournamentStatus) {
  const badges = {
    OPEN: { label: 'Open', className: 'chip chip-success' },
    INVITE_ONLY: { label: 'Invite Only', className: 'chip chip-warning' },
    CLOSED: { label: 'Closed', className: 'chip chip-error' },
  };
  return badges[status];
}

function getPlayerStatusBadge(status: string | null) {
  if (!status) return null;

  const badges: Record<string, { label: string; className: string }> = {
    REGISTERED: { label: 'Registered', className: 'chip chip-success' },
    WITHDRAWN: { label: 'Withdrawn', className: 'chip chip-muted' },
    REJECTED: { label: 'Rejected', className: 'chip chip-error' },
    PENDING_INVITE: { label: 'Invite Requested', className: 'chip chip-info' },
    WAITLISTED: { label: 'Waitlisted', className: 'chip chip-warning' },
  };
  return badges[status];
}

function formatCost(cents: number | null, registrationType?: RegistrationType): string {
  if (cents === null) return 'Free';
  const price = `$${(cents / 100).toFixed(2)}`;
  // Add "+HST" for paid tournaments
  return registrationType === 'PAID' ? `${price} +HST` : price;
}

export function TournamentCard({
  tournament,
  playerRegistrationStatus,
  registeredStopIds = [],
  paymentStatus,
  registrationId,
  onRegister,
  onRequestInvite,
  onJoinWaitlist,
}: TournamentCardProps) {
  const statusBadge = getStatusBadge(tournament.registrationStatus);
  const playerBadge = getPlayerStatusBadge(playerRegistrationStatus ?? null);

  const isFull = tournament.maxPlayers !== null && tournament.registeredCount >= tournament.maxPlayers;
  
  // Filter stops to only include future/available stops (stops that haven't ended yet)
  const now = new Date();
  const availableStops = tournament.stops.filter(stop => {
    if (!stop.endAt) return true; // If no end date, consider it available
    const endDate = new Date(stop.endAt);
    return endDate >= now; // Stop is available if it hasn't ended yet
  });
  
  // For multi-stop tournaments, check if player has registered for all available stops
  const hasMultipleStops = tournament.stops.length > 1;
  const allAvailableStopsRegistered = hasMultipleStops && availableStops.length > 0
    ? availableStops.every(stop => registeredStopIds.includes(stop.id))
    : false;
  
  // Check if payment is pending for a registered user
  const needsPayment = playerRegistrationStatus === 'REGISTERED' 
    && tournament.registrationType === 'PAID' 
    && paymentStatus === 'PENDING';
  
  // Player can register if:
  // - Tournament is OPEN
  // - There are available stops to register for
  // - Player is not registered OR (multi-stop tournament AND not all available stops registered)
  // - Tournament is not full
  // - Payment is not pending (if payment pending, show "Complete Payment" instead)
  const canRegister = tournament.registrationStatus === 'OPEN' 
    && availableStops.length > 0 // Must have at least one available stop
    && (!playerRegistrationStatus || (hasMultipleStops && !allAvailableStopsRegistered))
    && !isFull
    && !needsPayment; // Don't show register button if payment is pending
  const canRequestInvite = tournament.registrationStatus === 'INVITE_ONLY' && !playerRegistrationStatus;
  const canJoinWaitlist = isFull && tournament.isWaitlistEnabled && !playerRegistrationStatus;

  return (
    <div className="card space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 space-y-1">
          <h3 className="text-lg font-semibold text-primary">{tournament.name}</h3>
          <p className="text-sm text-muted">{tournament.type.replace(/_/g, ' ')}</p>
        </div>
        <div className="flex flex-col items-end gap-2">
          <span className={statusBadge.className}>{statusBadge.label}</span>
          {/* Only show player badge at top level for single-stop tournaments */}
          {playerBadge && !hasMultipleStops && <span className={playerBadge.className}>{playerBadge.label}</span>}
        </div>
      </div>

      {/* Registration Info */}
      <div className="space-y-2 text-sm">
        <div className="flex items-center justify-between">
          <span className="text-muted">Cost:</span>
          <span className="font-medium text-secondary">
            {formatCost(tournament.registrationCost, tournament.registrationType)}
          </span>
        </div>

        {tournament.maxPlayers && (
          <div className="flex items-center justify-between">
            <span className="text-muted">Players:</span>
            <span className="font-medium text-secondary">
              {tournament.registeredCount} / {tournament.maxPlayers}
              {isFull && ' (Full)'}
            </span>
          </div>
        )}
      </div>

      {/* Restrictions */}
      {tournament.restrictionNotes.length > 0 && (
        <div className="space-y-1">
          <p className="text-sm font-medium text-secondary">Restrictions:</p>
          <ul className="text-sm text-muted space-y-0.5">
            {tournament.restrictionNotes.map((note, idx) => (
              <li key={idx}>• {note}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Dates */}
      {tournament.stops.length > 0 && (
        <div className="text-sm text-muted">
          <p className="font-medium text-secondary mb-1">Schedule:</p>
          {tournament.stops.map((stop) => {
            const isRegisteredForStop = registeredStopIds.includes(stop.id);
            return (
              <div key={stop.id} className="flex items-center justify-between py-1">
                <div className="flex items-center gap-2">
                  <span>{stop.name}</span>
                  {/* Show registered badge for multi-stop tournaments */}
                  {hasMultipleStops && isRegisteredForStop && playerBadge && (
                    <span className={`${playerBadge.className} text-xs`}>{playerBadge.label}</span>
                  )}
                </div>
                <span className="text-xs">
                  {stop.startAt ? formatDateRangeUTC(stop.startAt, stop.endAt) : 'TBD'}
                </span>
              </div>
            );
          })}
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-2 pt-2 border-t border-border-subtle">
        <Link
          href={`/tournament/${tournament.id}`}
          className="btn btn-ghost btn-sm flex-1"
        >
          View Scores
        </Link>

        {needsPayment && registrationId && (
          <Link
            href={`/register/${tournament.id}/payment/status/${registrationId}`}
            className="btn btn-primary btn-sm flex-1"
          >
            Complete Payment
          </Link>
        )}

        {canRegister && onRegister && (
          <button
            onClick={() => onRegister(tournament.id)}
            className="btn btn-primary btn-sm flex-1"
          >
            Register Now
          </button>
        )}

        {canRequestInvite && onRequestInvite && (
          <button
            onClick={() => onRequestInvite(tournament.id)}
            className="btn btn-secondary btn-sm flex-1"
          >
            Request Invite
          </button>
        )}

        {canJoinWaitlist && onJoinWaitlist && (
          <button
            onClick={() => onJoinWaitlist(tournament.id)}
            className="btn btn-warning btn-sm flex-1"
          >
            Join Waitlist
          </button>
        )}
      </div>
    </div>
  );
}
