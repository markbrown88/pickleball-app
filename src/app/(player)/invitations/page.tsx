'use client';

import { useState, useEffect, useCallback } from 'react';
import { Mail, Clock, CheckCircle, XCircle, Calendar, User } from 'lucide-react';

type InviteStatus = 'PENDING' | 'ACCEPTED' | 'DECLINED' | 'CANCELLED' | 'EXPIRED';

type Invitation = {
  id: string;
  tournamentId: string;
  tournamentName: string;
  tournamentStartDate: string | null;
  tournamentEndDate: string | null;
  status: InviteStatus;
  invitedBy: string;
  createdAt: string;
  expiresAt: string;
  respondedAt: string | null;
  notes: string | null;
};

export default function InvitationsPage() {
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [processingId, setProcessingId] = useState<string | null>(null);

  const loadInvitations = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch('/api/player/invites');

      if (!response.ok) {
        throw new Error('Failed to load invitations');
      }

      const data = await response.json();
      setInvitations(data.invites || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load invitations');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadInvitations();
  }, [loadInvitations]);

  const handleAccept = async (inviteId: string, tournamentName: string) => {
    try {
      setProcessingId(inviteId);
      setError(null);
      setSuccess(null);

      const response = await fetch(`/api/player/invites/${inviteId}/accept`, {
        method: 'POST',
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to accept invitation');
      }

      const data = await response.json();
      setSuccess(`Invitation accepted! You can now register for ${tournamentName}.`);
      await loadInvitations();

      // Redirect to tournament page after a short delay
      setTimeout(() => {
        window.location.href = `/tournament/${data.tournamentId}`;
      }, 1500);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to accept invitation');
    } finally {
      setProcessingId(null);
    }
  };

  const handleDecline = async (inviteId: string) => {
    if (!confirm('Are you sure you want to decline this invitation?')) return;

    try {
      setProcessingId(inviteId);
      setError(null);
      setSuccess(null);

      const response = await fetch(`/api/player/invites/${inviteId}/decline`, {
        method: 'POST',
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to decline invitation');
      }

      setSuccess('Invitation declined');
      await loadInvitations();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to decline invitation');
    } finally {
      setProcessingId(null);
    }
  };

  const getStatusIcon = (status: InviteStatus) => {
    switch (status) {
      case 'ACCEPTED':
        return <CheckCircle className="w-5 h-5 text-green-600" />;
      case 'DECLINED':
        return <XCircle className="w-5 h-5 text-red-600" />;
      case 'EXPIRED':
        return <Clock className="w-5 h-5 text-orange-600" />;
      default:
        return <Mail className="w-5 h-5 text-blue-600" />;
    }
  };

  const getStatusBadge = (status: InviteStatus) => {
    const baseClasses = 'px-3 py-1 text-sm rounded-full font-medium';
    switch (status) {
      case 'ACCEPTED':
        return <span className={`${baseClasses} bg-green-100 text-green-700`}>Accepted</span>;
      case 'DECLINED':
        return <span className={`${baseClasses} bg-red-100 text-red-700`}>Declined</span>;
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

  const pendingInvitations = invitations.filter((inv) => inv.status === 'PENDING');
  const respondedInvitations = invitations.filter((inv) => inv.status !== 'PENDING');

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <div className="flex items-center justify-center h-48">
          <div className="loading-spinner" aria-label="Loading invitations" />
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-primary mb-2">Tournament Invitations</h1>
        <p className="text-muted">View and respond to tournament invitations</p>
      </div>

      {/* Messages */}
      {error && (
        <div className="border border-error bg-error/10 text-error p-4 rounded">
          {error}
        </div>
      )}

      {success && (
        <div className="border border-green-600 bg-green-50 text-green-700 p-4 rounded">
          {success}
        </div>
      )}

      {/* Pending Invitations */}
      {pendingInvitations.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-xl font-semibold text-primary">Pending Invitations</h2>

          {pendingInvitations.map((invite) => (
            <div
              key={invite.id}
              className="card border-2 border-blue-200 bg-blue-50/50 hover:shadow-lg transition-shadow"
            >
              <div className="flex items-start gap-4">
                <div className="mt-1">{getStatusIcon(invite.status)}</div>

                <div className="flex-1">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <h3 className="text-xl font-semibold text-primary mb-1">
                        {invite.tournamentName}
                      </h3>
                      <div className="flex items-center gap-4 text-sm text-muted">
                        <div className="flex items-center gap-1">
                          <User className="w-4 h-4" />
                          Invited by {invite.invitedBy}
                        </div>
                        {invite.tournamentStartDate && (
                          <div className="flex items-center gap-1">
                            <Calendar className="w-4 h-4" />
                            {formatDate(invite.tournamentStartDate)}
                          </div>
                        )}
                      </div>
                    </div>
                    {getStatusBadge(invite.status)}
                  </div>

                  {invite.notes && (
                    <div className="mb-4 p-3 bg-yellow-50 border-l-4 border-yellow-400 rounded">
                      <p className="text-sm font-medium text-yellow-900 mb-1">
                        Note from {invite.invitedBy}:
                      </p>
                      <p className="text-sm text-yellow-800">{invite.notes}</p>
                    </div>
                  )}

                  <div className="flex items-center gap-3 text-sm text-muted mb-4">
                    <span>Expires: {formatDate(invite.expiresAt)}</span>
                    <span>•</span>
                    <span>Received: {formatDate(invite.createdAt)}</span>
                  </div>

                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => handleAccept(invite.id, invite.tournamentName)}
                      disabled={processingId === invite.id}
                      className="btn btn-primary"
                    >
                      {processingId === invite.id ? 'Processing...' : 'Accept & Register'}
                    </button>
                    <button
                      onClick={() => handleDecline(invite.id)}
                      disabled={processingId === invite.id}
                      className="btn btn-ghost"
                    >
                      Decline
                    </button>
                    <a
                      href={`/tournament/${invite.tournamentId}`}
                      className="text-secondary hover:text-secondary-hover text-sm font-medium"
                    >
                      View Tournament Details →
                    </a>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Past Invitations */}
      {respondedInvitations.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-xl font-semibold text-primary">Past Invitations</h2>

          {respondedInvitations.map((invite) => (
            <div key={invite.id} className="card opacity-75 hover:opacity-100 transition-opacity">
              <div className="flex items-start gap-4">
                <div className="mt-1">{getStatusIcon(invite.status)}</div>

                <div className="flex-1">
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <h3 className="text-lg font-semibold text-primary mb-1">
                        {invite.tournamentName}
                      </h3>
                      <div className="flex items-center gap-4 text-sm text-muted">
                        <span>Invited by {invite.invitedBy}</span>
                        {invite.respondedAt && (
                          <>
                            <span>•</span>
                            <span>Responded: {formatDate(invite.respondedAt)}</span>
                          </>
                        )}
                      </div>
                    </div>
                    {getStatusBadge(invite.status)}
                  </div>

                  {invite.status === 'ACCEPTED' && (
                    <a
                      href={`/tournament/${invite.tournamentId}`}
                      className="text-secondary hover:text-secondary-hover text-sm font-medium inline-block mt-2"
                    >
                      View Tournament →
                    </a>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Empty State */}
      {invitations.length === 0 && (
        <div className="card text-center py-16">
          <Mail className="w-16 h-16 text-muted mx-auto mb-4" />
          <h3 className="text-xl font-medium text-primary mb-2">No invitations yet</h3>
          <p className="text-muted mb-6">
            When you receive tournament invitations, they'll appear here
          </p>
          <a href="/tournaments" className="btn btn-secondary">
            Browse Tournaments
          </a>
        </div>
      )}
    </div>
  );
}
