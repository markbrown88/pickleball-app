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
  paymentStatus: 'PENDING' | 'COMPLETED' | 'REFUNDED' | 'FAILED';
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

      setData(json);
    } catch (error) {
      console.error('Failed to load registrations:', error);
      setData(null);
    } finally {
      setLoading(false);
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
                        <span
                          className={`chip ${
                            reg.paymentStatus === 'COMPLETED'
                              ? 'chip-success'
                              : reg.paymentStatus === 'PENDING'
                              ? 'chip-warning'
                              : reg.paymentStatus === 'REFUNDED'
                              ? 'chip-info'
                              : 'chip-error'
                          }`}
                        >
                          {reg.paymentStatus}
                        </span>
                      </td>
                      <td className="p-3 text-sm text-muted">
                        {new Date(reg.registeredAt).toLocaleDateString()}
                      </td>
                      <td className="p-3 text-right">
                        <button className="btn btn-ghost btn-sm">View</button>
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
                            <button className="btn btn-success btn-sm">Approve</button>
                            <button className="btn btn-error btn-sm">Reject</button>
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
                          <button className="btn btn-primary btn-sm">Promote</button>
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
    </div>
  );
}
