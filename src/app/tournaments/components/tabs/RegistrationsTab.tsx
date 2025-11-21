'use client';

import { useEffect, useState } from 'react';

type RegistrationData = {
  id: string;
  player: {
    id: string;
    name: string;
    email: string | null;
  };
  status: 'REGISTERED' | 'WITHDRAWN' | 'REJECTED';
  paymentStatus: 'PENDING' | 'PAID' | 'COMPLETED' | 'REFUNDED' | 'FAILED';
  amountPaid: number | null;
  registeredAt: string;
  withdrawnAt: string | null;
  rejectedAt: string | null;
  rejectionReason: string | null;
};

type InviteRequestData = {
  id: string;
  player: {
    id: string;
    name: string;
    email: string | null;
  };
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  requestedAt: string;
  reviewedAt: string | null;
  notes: string | null;
};

type WaitlistData = {
  id: string;
  player: {
    id: string;
    name: string;
    email: string | null;
  };
  position: number;
  status: 'ACTIVE' | 'NOTIFIED' | 'EXPIRED' | 'PROMOTED' | 'REMOVED';
  joinedAt: string;
};

type RegistrationsTabProps = {
  tournamentId: string;
};

export function RegistrationsTab({ tournamentId }: RegistrationsTabProps) {
  const [loading, setLoading] = useState(true);
  const [tournamentRegistrationType, setTournamentRegistrationType] = useState<'FREE' | 'PAID'>('FREE');
  const [data, setData] = useState<{
    registrations: RegistrationData[];
    inviteRequests: InviteRequestData[];
    waitlist: WaitlistData[];
    summary: {
      totalRegistered: number;
      pendingInviteRequests: number;
      activeWaitlist: number;
    };
  } | null>(null);
  const [activeView, setActiveView] = useState<'registrations' | 'requests' | 'waitlist'>('registrations');
  const [processing, setProcessing] = useState<string | null>(null);

  // Manual registration modal
  const [showManualRegisterModal, setShowManualRegisterModal] = useState(false);
  const [playerSearchTerm, setPlayerSearchTerm] = useState('');
  const [playerSearchResults, setPlayerSearchResults] = useState<{id: string; name: string}[]>([]);
  const [selectedPlayerId, setSelectedPlayerId] = useState<string | null>(null);
  const [registerNotes, setRegisterNotes] = useState('');

  // Reject registration modal
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectingRegistration, setRejectingRegistration] = useState<RegistrationData | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  useEffect(() => {
    loadData();
  }, [tournamentId]);

  async function loadData() {
    try {
      setLoading(true);
      const response = await fetch(`/api/admin/tournaments/${tournamentId}/registrations`);

      if (!response.ok) {
        console.error('Failed to load registrations:', response.status);
        setData(null);
        return;
      }

      const json = await response.json();

      // Check if the response has the expected structure
      if (!json.summary) {
        console.error('Invalid response structure:', json);
        setData(null);
        return;
      }

      // Store tournament registration type
      if (json.tournament?.registrationType) {
        setTournamentRegistrationType(json.tournament.registrationType);
      }

      setData(json);
    } catch (error) {
      console.error('Failed to load registrations:', error);
      setData(null);
    } finally {
      setLoading(false);
    }
  }

  async function handleInviteRequest(requestId: string, action: 'approve' | 'reject') {
    try {
      setProcessing(requestId);
      const response = await fetch(
        `/api/admin/tournaments/${tournamentId}/invite-requests/${requestId}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action }),
        }
      );

      if (!response.ok) {
        const error = await response.json();
        alert(error.error || 'Failed to process request');
        return;
      }

      const result = await response.json();
      alert(result.message);
      await loadData(); // Reload data
    } catch (error) {
      console.error('Error processing invite request:', error);
      alert('Failed to process invite request');
    } finally {
      setProcessing(null);
    }
  }

  async function handlePromoteFromWaitlist(entryId: string) {
    try {
      setProcessing(entryId);
      const response = await fetch(
        `/api/admin/tournaments/${tournamentId}/waitlist/${entryId}/promote`,
        {
          method: 'POST',
        }
      );

      if (!response.ok) {
        const error = await response.json();
        alert(error.error || 'Failed to promote player');
        return;
      }

      const result = await response.json();
      alert(result.message);
      await loadData(); // Reload data
    } catch (error) {
      console.error('Error promoting from waitlist:', error);
      alert('Failed to promote player from waitlist');
    } finally {
      setProcessing(null);
    }
  }

  async function searchPlayers(term: string) {
    if (term.length < 3) {
      setPlayerSearchResults([]);
      return;
    }

    try {
      const response = await fetch(`/api/admin/players/search?term=${encodeURIComponent(term)}`);
      if (!response.ok) return;

      const data = await response.json();
      const results = (data.items || []).map((item: any) => ({
        id: item.id,
        name: item.name || `${item.firstName || ''} ${item.lastName || ''}`.trim() || 'Unknown',
      }));
      setPlayerSearchResults(results);
    } catch (error) {
      console.error('Error searching players:', error);
    }
  }

  async function handleManualRegister() {
    if (!selectedPlayerId) {
      alert('Please select a player');
      return;
    }

    try {
      setProcessing('manual-register');
      const response = await fetch(`/api/admin/tournaments/${tournamentId}/register-player`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          playerId: selectedPlayerId,
          notes: registerNotes || undefined,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        alert(error.error || 'Failed to register player');
        return;
      }

      const result = await response.json();
      alert(result.message);
      setShowManualRegisterModal(false);
      setPlayerSearchTerm('');
      setPlayerSearchResults([]);
      setSelectedPlayerId(null);
      setRegisterNotes('');
      await loadData();
    } catch (error) {
      console.error('Error registering player:', error);
      alert('Failed to register player');
    } finally {
      setProcessing(null);
    }
  }

  async function handleRejectRegistration() {
    if (!rejectingRegistration || !rejectReason.trim()) {
      alert('Please provide a rejection reason');
      return;
    }

    try {
      setProcessing('reject');
      const response = await fetch(
        `/api/admin/tournaments/${tournamentId}/registrations/${rejectingRegistration.id}/reject`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ reason: rejectReason }),
        }
      );

      if (!response.ok) {
        const error = await response.json();
        alert(error.error || 'Failed to reject registration');
        return;
      }

      const result = await response.json();
      alert(result.message);
      setShowRejectModal(false);
      setRejectingRegistration(null);
      setRejectReason('');
      await loadData();
    } catch (error) {
      console.error('Error rejecting registration:', error);
      alert('Failed to reject registration');
    } finally {
      setProcessing(null);
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center items-center h-48">
        <div className="loading-spinner" />
      </div>
    );
  }

  if (!data) {
    return <div className="text-center text-muted py-8">Failed to load registrations</div>;
  }

  const renderRegistrationsContent = () => (
    <div className="space-y-2">
      {/* Manual Register Button */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-end">
        <span className="text-sm text-muted sm:hidden">
          Need to add someone manually?
        </span>
        <button
          className="btn btn-primary w-full sm:w-auto"
          onClick={() => setShowManualRegisterModal(true)}
        >
          + Manual Register Player
        </button>
      </div>

      {data.registrations.length === 0 ? (
        <div className="card text-center py-8 text-muted">No registrations yet</div>
      ) : (
        <div className="card overflow-hidden">
          <div className="md:overflow-x-visible overflow-x-auto">
            <table className="w-full min-w-[600px]">
              <thead className="bg-surface-1">
                <tr>
                  <th className="text-left p-3 text-sm font-medium text-secondary">Player</th>
                  <th className="text-left p-3 text-sm font-medium text-secondary">Status</th>
                  <th className="text-left p-3 text-sm font-medium text-secondary">Payment</th>
                  <th className="text-left p-3 text-sm font-medium text-secondary">Registered</th>
                  <th className="text-right p-3 text-sm font-medium text-secondary">Actions</th>
                </tr>
              </thead>
              <tbody>
                {data.registrations.map((reg) => (
                  <tr key={reg.id} className="border-t border-border-subtle hover:bg-surface-1">
                    <td className="p-3">
                      <div className="font-medium text-primary">{reg.player.name}</div>
                      <div className="text-sm text-muted">{reg.player.email}</div>
                    </td>
                    <td className="p-3">
                      <span
                        className={`chip ${
                          reg.status === 'REGISTERED'
                            ? 'chip-success'
                            : reg.status === 'WITHDRAWN'
                            ? 'chip-muted'
                            : 'chip-error'
                        }`}
                      >
                        {reg.status}
                      </span>
                    </td>
                    <td className="p-3">
                      {tournamentRegistrationType === 'FREE' ? (
                        <span className="chip chip-success">
                          Free
                        </span>
                      ) : (
                        <span
                          className={`chip ${
                            reg.paymentStatus === 'PAID' || reg.paymentStatus === 'COMPLETED'
                              ? 'chip-success'
                              : reg.paymentStatus === 'PENDING'
                              ? 'chip-warning'
                              : reg.paymentStatus === 'REFUNDED'
                              ? 'chip-info'
                              : 'chip-error'
                          }`}
                        >
                          {reg.paymentStatus === 'PAID' || reg.paymentStatus === 'COMPLETED' ? 'Paid' : reg.paymentStatus}
                        </span>
                      )}
                    </td>
                    <td className="p-3 text-sm text-muted">
                      {new Date(reg.registeredAt).toLocaleDateString()}
                    </td>
                    <td className="p-3 text-right space-x-2">
                      {(reg.status === 'REGISTERED' || reg.status === 'REJECTED' || reg.status === 'WITHDRAWN') && (
                        <>
                          {reg.status === 'REGISTERED' && (
                            <button
                              className="btn btn-error btn-sm"
                              onClick={() => {
                                setRejectingRegistration(reg);
                                setShowRejectModal(true);
                              }}
                            >
                              Reject
                            </button>
                          )}
                          <button
                            className="btn btn-ghost btn-sm text-error"
                            onClick={async () => {
                              if (!confirm(`Delete registration for ${reg.player.name}? This cannot be undone.`)) {
                                return;
                              }
                              try {
                                setProcessing(reg.id);
                                const response = await fetch(
                                  `/api/admin/tournaments/${tournamentId}/registrations/${reg.id}`,
                                  { method: 'DELETE' }
                                );
                                if (!response.ok) {
                                  const error = await response.json();
                                  alert(error.error || 'Failed to delete registration');
                                  return;
                                }
                                await loadData();
                                alert('Registration deleted successfully');
                              } catch (error) {
                                console.error('Error deleting registration:', error);
                                alert('Failed to delete registration');
                              } finally {
                                setProcessing(null);
                              }
                            }}
                            disabled={processing === reg.id}
                          >
                            Delete
                          </button>
                        </>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );

  const renderRequestsContent = () => (
    <div className="space-y-2">
      {data.inviteRequests.length === 0 ? (
        <div className="card text-center py-8 text-muted">No invite requests</div>
      ) : (
        <div className="card overflow-hidden">
          <div className="md:overflow-x-visible overflow-x-auto">
            <table className="w-full min-w-[600px]">
              <thead className="bg-surface-1">
                <tr>
                  <th className="text-left p-3 text-sm font-medium text-secondary">Player</th>
                  <th className="text-left p-3 text-sm font-medium text-secondary">Club</th>
                  <th className="text-left p-3 text-sm font-medium text-secondary">Requested</th>
                  <th className="text-right p-3 text-sm font-medium text-secondary">Actions</th>
                </tr>
              </thead>
              <tbody>
                {data.inviteRequests.map((request) => (
                  <tr key={request.id} className="border-t border-border-subtle hover:bg-surface-1">
                    <td className="p-3">
                      <div className="font-medium text-primary">{request.player.name}</div>
                      <div className="text-sm text-muted">{request.player.email}</div>
                    </td>
                    <td className="p-3 text-sm text-muted">{request.club?.name || '—'}</td>
                    <td className="p-3 text-sm text-muted">
                      {new Date(request.requestedAt).toLocaleDateString()}
                    </td>
                    <td className="p-3 text-right space-x-2">
                      <button
                        className="btn btn-success btn-sm"
                        onClick={() => handleApproveInvite(request.id)}
                        disabled={processing === request.id}
                      >
                        Approve
                      </button>
                      <button
                        className="btn btn-ghost btn-sm text-error"
                        onClick={() => handleRejectInvite(request.id)}
                        disabled={processing === request.id}
                      >
                        Reject
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );

  const renderWaitlistContent = () => (
    <div className="space-y-2">
      {data.waitlist.length === 0 ? (
        <div className="card text-center py-8 text-muted">No players on the waitlist</div>
      ) : (
        <div className="card overflow-hidden">
          <div className="md:overflow-x-visible overflow-x-auto">
            <table className="w-full min-w-[600px]">
              <thead className="bg-surface-1">
                <tr>
                  <th className="text-left p-3 text-sm font-medium text-secondary">Player</th>
                  <th className="text-left p-3 text-sm font-medium text-secondary">Requested</th>
                  <th className="text-left p-3 text-sm font-medium text-secondary">Priority</th>
                  <th className="text-right p-3 text-sm font-medium text-secondary">Actions</th>
                </tr>
              </thead>
              <tbody>
                {data.waitlist.map((entry) => (
                  <tr key={entry.id} className="border-t border-border-subtle hover:bg-surface-1">
                    <td className="p-3">
                      <div className="font-medium text-primary">{entry.player.name}</div>
                      <div className="text-sm text-muted">{entry.player.email}</div>
                    </td>
                    <td className="p-3 text-sm text-muted">
                      {new Date(entry.requestedAt).toLocaleDateString()}
                    </td>
                    <td className="p-3">
                      <span className="chip chip-info text-[10px] px-2 py-0.5">
                        {entry.priority || 'Standard'}
                      </span>
                    </td>
                    <td className="p-3 text-right space-x-2">
                      <button
                        className="btn btn-success btn-sm"
                        onClick={() => handlePromoteFromWaitlist(entry.id)}
                        disabled={processing === entry.id}
                      >
                        Promote
                      </button>
                      <button
                        className="btn btn-ghost btn-sm text-error"
                        onClick={() => handleRemoveFromWaitlist(entry.id)}
                        disabled={processing === entry.id}
                      >
                        Remove
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <div className="card space-y-2">
          <div className="text-sm text-muted">Registered Players</div>
          <div className="text-3xl font-bold text-primary">{data.summary.totalRegistered}</div>
        </div>
        <div className="card space-y-2">
          <div className="text-sm text-muted">Pending Requests</div>
          <div className="text-3xl font-bold text-warning">{data.summary.pendingInviteRequests}</div>
        </div>
        <div className="card space-y-2">
          <div className="text-sm text-muted">On Waitlist</div>
          <div className="text-3xl font-bold text-info">{data.summary.activeWaitlist}</div>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-border-subtle">
        <nav className="flex gap-1 -mb-px">
          <button
            className={`tab-button ${activeView === 'registrations' ? 'active' : ''}`}
            onClick={() => setActiveView('registrations')}
          >
            Registrations ({data.registrations.length})
          </button>
          <button
            className={`tab-button ${activeView === 'requests' ? 'active' : ''}`}
            onClick={() => setActiveView('requests')}
          >
            Invite Requests ({data.inviteRequests.length})
          </button>
          <button
            className={`tab-button ${activeView === 'waitlist' ? 'active' : ''}`}
            onClick={() => setActiveView('waitlist')}
          >
            Waitlist ({data.waitlist.length})
          </button>
        </nav>
      </div>

      {/* Content */}
      {activeView === 'registrations' && (
        <div className="space-y-2">
          {/* Manual Register Button */}
          <div className="flex justify-end">
            <button
              className="btn btn-primary"
              onClick={() => setShowManualRegisterModal(true)}
            >
              + Manual Register Player
            </button>
          </div>

          {data.registrations.length === 0 ? (
            <div className="card text-center py-8 text-muted">No registrations yet</div>
          ) : (
            <div className="card overflow-hidden">
              <table className="w-full">
                <thead className="bg-surface-1">
                  <tr>
                    <th className="text-left p-3 text-sm font-medium text-secondary">Player</th>
                    <th className="text-left p-3 text-sm font-medium text-secondary">Status</th>
                    <th className="text-left p-3 text-sm font-medium text-secondary">Payment</th>
                    <th className="text-left p-3 text-sm font-medium text-secondary">Registered</th>
                    <th className="text-right p-3 text-sm font-medium text-secondary">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {data.registrations.map((reg) => (
                    <tr key={reg.id} className="border-t border-border-subtle hover:bg-surface-1">
                      <td className="p-3">
                        <div className="font-medium text-primary">{reg.player.name}</div>
                        <div className="text-sm text-muted">{reg.player.email}</div>
                      </td>
                      <td className="p-3">
                        <span
                          className={`chip ${
                            reg.status === 'REGISTERED'
                              ? 'chip-success'
                              : reg.status === 'WITHDRAWN'
                              ? 'chip-muted'
                              : 'chip-error'
                          }`}
                        >
                          {reg.status}
                        </span>
                      </td>
                      <td className="p-3">
                        {tournamentRegistrationType === 'FREE' ? (
                          <span className="chip chip-success">
                            Free
                          </span>
                        ) : (
                          <span
                            className={`chip ${
                              reg.paymentStatus === 'PAID' || reg.paymentStatus === 'COMPLETED'
                                ? 'chip-success'
                                : reg.paymentStatus === 'PENDING'
                                ? 'chip-warning'
                                : reg.paymentStatus === 'REFUNDED'
                                ? 'chip-info'
                                : 'chip-error'
                            }`}
                          >
                            {reg.paymentStatus === 'PAID' || reg.paymentStatus === 'COMPLETED' ? 'Paid' : reg.paymentStatus}
                          </span>
                        )}
                      </td>
                      <td className="p-3 text-sm text-muted">
                        {new Date(reg.registeredAt).toLocaleDateString()}
                      </td>
                      <td className="p-3 text-right space-x-2">
                        {(reg.status === 'REGISTERED' || reg.status === 'REJECTED' || reg.status === 'WITHDRAWN') && (
                          <>
                            {reg.status === 'REGISTERED' && (
                              <button
                                className="btn btn-error btn-sm"
                                onClick={() => {
                                  setRejectingRegistration(reg);
                                  setShowRejectModal(true);
                                }}
                              >
                                Reject
                              </button>
                            )}
                            <button
                              className="btn btn-ghost btn-sm text-error"
                              onClick={async () => {
                                if (!confirm(`Delete registration for ${reg.player.name}? This cannot be undone.`)) {
                                  return;
                                }
                                try {
                                  setProcessing(reg.id);
                                  const response = await fetch(
                                    `/api/admin/tournaments/${tournamentId}/registrations/${reg.id}`,
                                    { method: 'DELETE' }
                                  );
                                  if (!response.ok) {
                                    const error = await response.json();
                                    alert(error.error || 'Failed to delete registration');
                                    return;
                                  }
                                  await loadData();
                                  alert('Registration deleted successfully');
                                } catch (error) {
                                  console.error('Error deleting registration:', error);
                                  alert('Failed to delete registration');
                                } finally {
                                  setProcessing(null);
                                }
                              }}
                              disabled={processing === reg.id}
                            >
                              Delete
                            </button>
                          </>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {activeView === 'requests' && (
        <div className="space-y-2">
          {data.inviteRequests.length === 0 ? (
            <div className="card text-center py-8 text-muted">No invite requests</div>
          ) : (
            <div className="card overflow-hidden">
              <table className="w-full">
                <thead className="bg-surface-1">
                  <tr>
                    <th className="text-left p-3 text-sm font-medium text-secondary">Player</th>
                    <th className="text-left p-3 text-sm font-medium text-secondary">Status</th>
                    <th className="text-left p-3 text-sm font-medium text-secondary">Requested</th>
                    <th className="text-right p-3 text-sm font-medium text-secondary">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {data.inviteRequests.map((req) => (
                    <tr key={req.id} className="border-t border-border-subtle hover:bg-surface-1">
                      <td className="p-3">
                        <div className="font-medium text-primary">{req.player.name}</div>
                        <div className="text-sm text-muted">{req.player.email}</div>
                      </td>
                      <td className="p-3">
                        <span
                          className={`chip ${
                            req.status === 'PENDING'
                              ? 'chip-warning'
                              : req.status === 'APPROVED'
                              ? 'chip-success'
                              : 'chip-error'
                          }`}
                        >
                          {req.status}
                        </span>
                      </td>
                      <td className="p-3 text-sm text-muted">
                        {new Date(req.requestedAt).toLocaleDateString()}
                      </td>
                      <td className="p-3 text-right space-x-2">
                        {req.status === 'PENDING' && (
                          <>
                            <button
                              className="btn btn-success btn-sm"
                              onClick={() => handleInviteRequest(req.id, 'approve')}
                              disabled={processing === req.id}
                            >
                              {processing === req.id ? 'Processing...' : 'Approve'}
                            </button>
                            <button
                              className="btn btn-error btn-sm"
                              onClick={() => handleInviteRequest(req.id, 'reject')}
                              disabled={processing === req.id}
                            >
                              {processing === req.id ? 'Processing...' : 'Reject'}
                            </button>
                          </>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {activeView === 'waitlist' && (
        <div className="space-y-2">
          {data.waitlist.length === 0 ? (
            <div className="card text-center py-8 text-muted">No one on waitlist</div>
          ) : (
            <div className="card overflow-hidden">
              <table className="w-full">
                <thead className="bg-surface-1">
                  <tr>
                    <th className="text-left p-3 text-sm font-medium text-secondary">Position</th>
                    <th className="text-left p-3 text-sm font-medium text-secondary">Player</th>
                    <th className="text-left p-3 text-sm font-medium text-secondary">Status</th>
                    <th className="text-left p-3 text-sm font-medium text-secondary">Joined</th>
                    <th className="text-right p-3 text-sm font-medium text-secondary">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {data.waitlist.map((entry) => (
                    <tr key={entry.id} className="border-t border-border-subtle hover:bg-surface-1">
                      <td className="p-3 font-semibold text-primary">#{entry.position}</td>
                      <td className="p-3">
                        <div className="font-medium text-primary">{entry.player.name}</div>
                        <div className="text-sm text-muted">{entry.player.email}</div>
                      </td>
                      <td className="p-3">
                        <span
                          className={`chip ${
                            entry.status === 'ACTIVE'
                              ? 'chip-info'
                              : entry.status === 'NOTIFIED'
                              ? 'chip-warning'
                              : entry.status === 'PROMOTED'
                              ? 'chip-success'
                              : 'chip-muted'
                          }`}
                        >
                          {entry.status}
                        </span>
                      </td>
                      <td className="p-3 text-sm text-muted">
                        {new Date(entry.joinedAt).toLocaleDateString()}
                      </td>
                      <td className="p-3 text-right">
                        {entry.status === 'ACTIVE' && (
                          <button
                            className="btn btn-primary btn-sm"
                            onClick={() => handlePromoteFromWaitlist(entry.id)}
                            disabled={processing === entry.id}
                          >
                            {processing === entry.id ? 'Processing...' : 'Promote'}
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Manual Register Modal */}
      {showManualRegisterModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="card max-w-lg w-full mx-4">
            <h3 className="text-lg font-bold mb-4">Manual Register Player</h3>

            <div className="space-y-4">
              <div>
                <label className="label">Search Player</label>
                <input
                  type="text"
                  className="input"
                  placeholder="Type name to search (min 3 chars)..."
                  value={playerSearchTerm}
                  onChange={(e) => {
                    setPlayerSearchTerm(e.target.value);
                    searchPlayers(e.target.value);
                  }}
                />
              </div>

              {playerSearchResults.length > 0 && (
                <div className="max-h-48 overflow-y-auto space-y-2">
                  {playerSearchResults.map((p) => (
                    <div
                      key={p.id}
                      className={`p-3 border rounded cursor-pointer hover:bg-surface-1 ${
                        selectedPlayerId === p.id ? 'border-primary bg-primary/10' : 'border-border-subtle'
                      }`}
                      onClick={() => setSelectedPlayerId(p.id)}
                    >
                      {p.name}
                      {selectedPlayerId === p.id && <span className="ml-2 chip chip-primary chip-sm">Selected</span>}
                    </div>
                  ))}
                </div>
              )}

              {selectedPlayerId && (
                <div>
                  <label className="label">Notes (optional)</label>
                  <textarea
                    className="input"
                    rows={3}
                    placeholder="Admin notes..."
                    value={registerNotes}
                    onChange={(e) => setRegisterNotes(e.target.value)}
                  />
                </div>
              )}

              <div className="flex gap-2 justify-end">
                <button
                  className="btn btn-ghost"
                  onClick={() => {
                    setShowManualRegisterModal(false);
                    setPlayerSearchTerm('');
                    setPlayerSearchResults([]);
                    setSelectedPlayerId(null);
                    setRegisterNotes('');
                  }}
                >
                  Cancel
                </button>
                <button
                  className="btn btn-primary"
                  onClick={handleManualRegister}
                  disabled={!selectedPlayerId || processing === 'manual-register'}
                >
                  {processing === 'manual-register' ? 'Registering...' : 'Register Player'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Reject Modal */}
      {showRejectModal && rejectingRegistration && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="card max-w-lg w-full mx-4">
            <h3 className="text-lg font-bold mb-4">Reject Registration</h3>

            <div className="space-y-4">
              <div className="p-3 bg-surface-1 rounded">
                <div className="font-medium">{rejectingRegistration.player.name}</div>
                <div className="text-sm text-muted">{rejectingRegistration.player.email}</div>
              </div>

              <div>
                <label className="label">Rejection Reason *</label>
                <textarea
                  className="input"
                  rows={4}
                  placeholder="Please provide a reason for rejection..."
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  required
                />
                <div className="text-sm text-muted mt-1">
                  This reason will be sent to the player via email.
                </div>
              </div>

              <div className="flex gap-2 justify-end">
                <button
                  className="btn btn-ghost"
                  onClick={() => {
                    setShowRejectModal(false);
                    setRejectingRegistration(null);
                    setRejectReason('');
                  }}
                >
                  Cancel
                </button>
                <button
                  className="btn btn-error"
                  onClick={handleRejectRegistration}
                  disabled={!rejectReason.trim() || processing === 'reject'}
                >
                  {processing === 'reject' ? 'Rejecting...' : 'Reject Registration'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
