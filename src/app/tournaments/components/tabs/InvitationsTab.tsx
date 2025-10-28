'use client';

import { useState, useEffect, useCallback } from 'react';
import { UserPlus, Mail, Clock, CheckCircle, XCircle, Ban } from 'lucide-react';

type InviteStatus = 'PENDING' | 'ACCEPTED' | 'DECLINED' | 'CANCELLED' | 'EXPIRED';

type Invitation = {
  id: string;
  playerId: string | null;
  playerName: string | null;
  inviteEmail: string | null;
  inviteName: string | null;
  status: InviteStatus;
  invitedBy: string;
  invitedByName: string;
  createdAt: string;
  expiresAt: string;
  respondedAt: string | null;
};

type InvitationsTabProps = {
  tournamentId: string;
  searchPlayers: (term: string) => Promise<Array<{ id: string; label: string }>>;
};

export function InvitationsTab({ tournamentId, searchPlayers }: InvitationsTabProps) {
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteType, setInviteType] = useState<'existing' | 'email'>('existing');
  const [selectedPlayer, setSelectedPlayer] = useState<{ id: string; label: string } | null>(null);
  const [playerSearchTerm, setPlayerSearchTerm] = useState('');
  const [playerOptions, setPlayerOptions] = useState<Array<{ id: string; label: string }>>([]);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteName, setInviteName] = useState('');
  const [expiryDays, setExpiryDays] = useState('7');
  const [notes, setNotes] = useState('');
  const [sending, setSending] = useState(false);

  const loadInvitations = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch(`/api/admin/tournaments/${tournamentId}/invites`);

      if (!response.ok) {
        throw new Error('Failed to load invitations');
      }

      const data = await response.json();
      setInvitations(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load invitations');
    } finally {
      setLoading(false);
    }
  }, [tournamentId]);

  useEffect(() => {
    void loadInvitations();
  }, [loadInvitations]);

  useEffect(() => {
    if (playerSearchTerm.trim().length >= 2) {
      const timer = setTimeout(async () => {
        const results = await searchPlayers(playerSearchTerm);
        setPlayerOptions(results);
      }, 300);
      return () => clearTimeout(timer);
    } else {
      setPlayerOptions([]);
    }
  }, [playerSearchTerm, searchPlayers]);

  const handleSendInvite = async () => {
    try {
      setSending(true);
      setError(null);

      const payload: any = {
        expiryDays: parseInt(expiryDays),
        notes: notes.trim() || null,
      };

      if (inviteType === 'existing') {
        if (!selectedPlayer) {
          throw new Error('Please select a player');
        }
        payload.playerId = selectedPlayer.id;
      } else {
        if (!inviteEmail.trim() || !inviteName.trim()) {
          throw new Error('Please provide email and name');
        }
        payload.inviteEmail = inviteEmail.trim();
        payload.inviteName = inviteName.trim();
      }

      const response = await fetch(`/api/admin/tournaments/${tournamentId}/invites`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to send invitation');
      }

      // Reset form and reload
      setShowInviteModal(false);
      setSelectedPlayer(null);
      setPlayerSearchTerm('');
      setInviteEmail('');
      setInviteName('');
      setExpiryDays('7');
      setNotes('');
      await loadInvitations();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send invitation');
    } finally {
      setSending(false);
    }
  };

  const handleCancelInvite = async (inviteId: string) => {
    if (!confirm('Are you sure you want to cancel this invitation?')) return;

    try {
      const response = await fetch(`/api/admin/tournaments/${tournamentId}/invites/${inviteId}/cancel`, {
        method: 'POST',
      });

      if (!response.ok) {
        throw new Error('Failed to cancel invitation');
      }

      await loadInvitations();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to cancel invitation');
    }
  };

  const handleResendInvite = async (inviteId: string) => {
    try {
      const response = await fetch(`/api/admin/tournaments/${tournamentId}/invites/${inviteId}/resend`, {
        method: 'POST',
      });

      if (!response.ok) {
        throw new Error('Failed to resend invitation');
      }

      setError(null);
      alert('Invitation resent successfully');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to resend invitation');
    }
  };

  const getStatusIcon = (status: InviteStatus) => {
    switch (status) {
      case 'ACCEPTED':
        return <CheckCircle className="w-4 h-4 text-green-600" />;
      case 'DECLINED':
        return <XCircle className="w-4 h-4 text-red-600" />;
      case 'CANCELLED':
        return <Ban className="w-4 h-4 text-gray-600" />;
      case 'EXPIRED':
        return <Clock className="w-4 h-4 text-orange-600" />;
      default:
        return <Clock className="w-4 h-4 text-blue-600" />;
    }
  };

  const getStatusBadge = (status: InviteStatus) => {
    const baseClasses = 'px-2 py-1 text-xs rounded';
    switch (status) {
      case 'ACCEPTED':
        return <span className={`${baseClasses} bg-green-100 text-green-700`}>Accepted</span>;
      case 'DECLINED':
        return <span className={`${baseClasses} bg-red-100 text-red-700`}>Declined</span>;
      case 'CANCELLED':
        return <span className={`${baseClasses} bg-gray-100 text-gray-700`}>Cancelled</span>;
      case 'EXPIRED':
        return <span className={`${baseClasses} bg-orange-100 text-orange-700`}>Expired</span>;
      default:
        return <span className={`${baseClasses} bg-blue-100 text-blue-700`}>Pending</span>;
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-primary">Tournament Invitations</h3>
          <p className="text-sm text-muted">Invite players to register for this tournament</p>
        </div>
        <button
          onClick={() => setShowInviteModal(true)}
          className="btn btn-primary flex items-center gap-2"
        >
          <UserPlus className="w-4 h-4" />
          Send Invitation
        </button>
      </div>

      {error && (
        <div className="border border-error bg-error/10 text-error p-3 rounded">
          {error}
        </div>
      )}

      {/* Invitations List */}
      {loading ? (
        <div className="flex items-center justify-center h-48">
          <div className="loading-spinner" />
        </div>
      ) : invitations.length === 0 ? (
        <div className="card text-center py-12">
          <Mail className="w-12 h-12 text-muted mx-auto mb-4" />
          <h4 className="text-lg font-medium text-primary mb-2">No invitations sent yet</h4>
          <p className="text-muted mb-4">Start by inviting players to register for this tournament</p>
          <button
            onClick={() => setShowInviteModal(true)}
            className="btn btn-secondary"
          >
            Send First Invitation
          </button>
        </div>
      ) : (
        <div className="card overflow-hidden">
          <table className="table">
            <thead>
              <tr>
                <th>Status</th>
                <th>Player / Email</th>
                <th>Invited By</th>
                <th>Sent</th>
                <th>Expires</th>
                <th>Responded</th>
                <th className="text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {invitations.map((invite) => (
                <tr key={invite.id}>
                  <td>
                    <div className="flex items-center gap-2">
                      {getStatusIcon(invite.status)}
                      {getStatusBadge(invite.status)}
                    </div>
                  </td>
                  <td>
                    {invite.playerName ? (
                      <span className="font-medium">{invite.playerName}</span>
                    ) : (
                      <div>
                        <div className="font-medium">{invite.inviteName}</div>
                        <div className="text-sm text-muted">{invite.inviteEmail}</div>
                      </div>
                    )}
                  </td>
                  <td className="text-muted">{invite.invitedByName}</td>
                  <td className="text-muted">{formatDate(invite.createdAt)}</td>
                  <td className="text-muted">{formatDate(invite.expiresAt)}</td>
                  <td className="text-muted">
                    {invite.respondedAt ? formatDate(invite.respondedAt) : '—'}
                  </td>
                  <td className="text-right">
                    <div className="flex items-center gap-2 justify-end">
                      {invite.status === 'PENDING' && (
                        <>
                          <button
                            onClick={() => handleResendInvite(invite.id)}
                            className="text-sm text-secondary hover:text-secondary-hover"
                            title="Resend invitation email"
                          >
                            Resend
                          </button>
                          <button
                            onClick={() => handleCancelInvite(invite.id)}
                            className="text-sm text-error hover:text-error-hover"
                            title="Cancel invitation"
                          >
                            Cancel
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Invite Modal */}
      {showInviteModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
            <div className="px-6 py-4 border-b border-border-subtle">
              <h3 className="text-lg font-semibold text-primary">Send Invitation</h3>
            </div>

            <div className="px-6 py-4 space-y-4">
              {/* Invite Type Selector */}
              <div>
                <label className="block text-sm font-medium text-primary mb-2">
                  Invite Type
                </label>
                <div className="flex gap-3">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      checked={inviteType === 'existing'}
                      onChange={() => setInviteType('existing')}
                      className="w-4 h-4"
                    />
                    <span className="text-sm">Existing Player</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      checked={inviteType === 'email'}
                      onChange={() => setInviteType('email')}
                      className="w-4 h-4"
                    />
                    <span className="text-sm">New Player (Email)</span>
                  </label>
                </div>
              </div>

              {/* Existing Player Search */}
              {inviteType === 'existing' && (
                <div>
                  <label className="block text-sm font-medium text-primary mb-2">
                    Search Player
                  </label>
                  <input
                    type="text"
                    value={playerSearchTerm}
                    onChange={(e) => setPlayerSearchTerm(e.target.value)}
                    placeholder="Type player name..."
                    className="input w-full"
                  />
                  {playerOptions.length > 0 && (
                    <div className="mt-2 border border-border-subtle rounded max-h-40 overflow-y-auto">
                      {playerOptions.map((option) => (
                        <button
                          key={option.id}
                          onClick={() => {
                            setSelectedPlayer(option);
                            setPlayerSearchTerm(option.label);
                            setPlayerOptions([]);
                          }}
                          className="w-full text-left px-3 py-2 hover:bg-surface-2 text-sm"
                        >
                          {option.label}
                        </button>
                      ))}
                    </div>
                  )}
                  {selectedPlayer && (
                    <div className="mt-2 text-sm text-muted">
                      Selected: <span className="font-medium text-primary">{selectedPlayer.label}</span>
                    </div>
                  )}
                </div>
              )}

              {/* Email Invite Fields */}
              {inviteType === 'email' && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-primary mb-2">
                      Name
                    </label>
                    <input
                      type="text"
                      value={inviteName}
                      onChange={(e) => setInviteName(e.target.value)}
                      placeholder="Player name"
                      className="input w-full"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-primary mb-2">
                      Email
                    </label>
                    <input
                      type="email"
                      value={inviteEmail}
                      onChange={(e) => setInviteEmail(e.target.value)}
                      placeholder="player@example.com"
                      className="input w-full"
                    />
                  </div>
                </>
              )}

              {/* Expiry Days */}
              <div>
                <label className="block text-sm font-medium text-primary mb-2">
                  Invitation Expires In (days)
                </label>
                <input
                  type="number"
                  value={expiryDays}
                  onChange={(e) => setExpiryDays(e.target.value)}
                  min="1"
                  max="90"
                  className="input w-full"
                />
              </div>

              {/* Notes */}
              <div>
                <label className="block text-sm font-medium text-primary mb-2">
                  Notes (Optional)
                </label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Add any additional information for the player..."
                  rows={3}
                  className="input w-full"
                />
              </div>
            </div>

            <div className="px-6 py-4 border-t border-border-subtle flex justify-end gap-3">
              <button
                onClick={() => setShowInviteModal(false)}
                className="btn btn-ghost"
                disabled={sending}
              >
                Cancel
              </button>
              <button
                onClick={handleSendInvite}
                className="btn btn-primary"
                disabled={sending}
              >
                {sending ? 'Sending...' : 'Send Invitation'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
