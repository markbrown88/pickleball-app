'use client';

import { useEffect, useMemo, useState, useCallback } from 'react';

import { useAdminUser } from '../admin/AdminContext';
import { useModal } from '../shared/ModalContext';
import GlobalModalManager from '../shared/GlobalModalManager';

const CA_PROVINCES = ['AB','BC','MB','NB','NL','NS','NT','NU','ON','PE','QC','SK','YT'] as const;
const US_STATES = [
  'AL','AK','AZ','AR','CA','CO','CT','DE','FL','GA','HI','ID','IL','IN','IA','KS','KY','LA','ME',
  'MD','MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ','NM','NY','NC','ND','OH','OK','OR','PA',
  'RI','SC','SD','TN','TX','UT','VT','VA','WA','WV','WI','WY'
] as const;

type Id = string;

type Club = {
  id: Id;
  fullName: string;
  name: string;
  address?: string | null;
  city?: string | null;
  region?: string | null;
  country: string;
  phone?: string | null;
  email?: string | null;
  description?: string | null;
  directorId?: string | null;
  logo?: string | null;
  director?: {
    id: string;
    firstName?: string | null;
    lastName?: string | null;
  } | null;
};

type Player = {
  id: Id;
  firstName?: string | null;
  lastName?: string | null;
  name?: string | null;
};

type ClubsResponse = Club[];

function extractErrorMessage(body: unknown, status: number): string {
  if (typeof body === 'string') return body;
  if (body && typeof body === 'object') {
    // Handle empty object
    if (Object.keys(body).length === 0) {
      return `HTTP ${status}: Empty response`;
    }
    // Handle error property
    if ('error' in body && typeof (body as { error?: unknown }).error === 'string') {
      return (body as { error: string }).error;
    }
    // Try to stringify the object for debugging
    try {
      return `HTTP ${status}: ${JSON.stringify(body)}`;
    } catch {
      return `HTTP ${status}: Invalid response format`;
    }
  }
  return `HTTP ${status}`;
}

async function api<T>(url: string, init?: RequestInit): Promise<T> {
  try {
    const res = await fetch(url, init);
    const contentType = res.headers.get('content-type') || '';
    const isJson = contentType.includes('application/json');
    
    let body: unknown;
    try {
      body = isJson ? await res.json() : await res.text();
    } catch (parseError) {
      console.error('Failed to parse response body:', parseError);
      body = await res.text().catch(() => 'Unable to read response');
    }
    
    if (!res.ok) {
      console.error('API Error:', {
        url,
        status: res.status,
        statusText: res.statusText,
        contentType,
        body: body || 'Empty response body'
      });
      throw new Error(extractErrorMessage(body, res.status));
    }
    return body as T;
  } catch (error) {
    if (error instanceof Error) {
      throw error;
    }
    console.error('Unexpected API error:', error);
    throw new Error(`API request failed: ${String(error)}`);
  }
}

export default function AdminClubsPage() {
  const admin = useAdminUser();
  const { openModal } = useModal();
  const [clubs, setClubs] = useState<Club[]>([]);
  const [players, setPlayers] = useState<Player[]>([]);
  const [sort, setSort] = useState<{ col: 'name' | 'city' | 'region' | 'country' | 'phone'; dir: 'asc' | 'desc' }>({ col: 'name', dir: 'asc' });
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  useEffect(() => {
    if (!admin.isAppAdmin && !admin.isTournamentAdmin) return;
    void loadClubs(sort);
    void loadPlayers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [admin.isAppAdmin, admin.isTournamentAdmin]);

  const sortedClubs = useMemo(() => clubs, [clubs]);

  async function loadClubs(nextSort: typeof sort) {
    try {
      setLoading(true);
      setErr(null);
      const data = await api<ClubsResponse>(
        `/api/admin/clubs?sort=${encodeURIComponent(`${nextSort.col}:${nextSort.dir}`)}`
      );
      setClubs(Array.isArray(data) ? data : []);
      setSort(nextSort);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  async function loadPlayers() {
    try {
      const data = await api<{ items: Player[] }>('/api/admin/players?take=100');
      const players = Array.isArray(data?.items) ? data.items : [];
      setPlayers(players);
    } catch (e) {
      console.error('Error loading players:', e);
      // Don't show error to user for players loading failure - it's not critical
      // The modal will still work, just without player suggestions
      setPlayers([]);
    }
  }

  const handleModalSave = useCallback(async (club: Partial<Club>) => {
    try {
      setErr(null);
      if (club.id) {
        await api(`/api/admin/clubs/${club.id}`, { 
          method: 'PUT', 
          headers: { 'Content-Type': 'application/json' }, 
          body: JSON.stringify(club) 
        });
      } else {
        await api('/api/admin/clubs', { 
          method: 'POST', 
          headers: { 'Content-Type': 'application/json' }, 
          body: JSON.stringify(club) 
        });
      }
      await loadClubs(sort);
      setInfo(club.id ? 'Club updated' : 'Club created');
    } catch (e: any) {
      console.error('Error saving club:', e);
      setErr(e?.message || 'Failed to save club');
      throw new Error(e?.message || 'Failed to save club');
    }
  }, [sort]);

  const handleAddClub = useCallback(() => {
    openModal('club');
  }, [openModal]);

  const handleEditClub = useCallback((club: Club) => {
    openModal('club', club);
  }, [openModal]);

  const clickSortClubs = useCallback((col: 'name' | 'city' | 'region' | 'country' | 'phone') => {
    const nextDir = sort.col === col && sort.dir === 'asc' ? 'desc' : 'asc';
    void loadClubs({ col, dir: nextDir });
  }, [sort]);


  async function removeClub(id: Id) {
    if (!confirm('Delete this club?')) return;
    try {
      setErr(null);
      await api(`/api/admin/clubs/${id}`, { method: 'DELETE' });
      setInfo('Club deleted');
      await loadClubs(sort);
    } catch (e) {
      setErr((e as Error).message);
    }
  }

  if (!admin.isAppAdmin && !admin.isTournamentAdmin) {
    return (
      <section className="space-y-6">
        <h1 className="text-2xl font-semibold text-primary">Clubs</h1>
        <div className="card">
          <p className="text-muted">Only administrators can manage clubs.</p>
        </div>
      </section>
    );
  }

  const isTournamentAdminOnly = admin.isTournamentAdmin && !admin.isAppAdmin;

  return (
    <section className="space-y-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-primary">
            {isTournamentAdminOnly ? 'My Club' : 'Clubs'}
          </h1>
          <p className="text-muted">
            {isTournamentAdminOnly
              ? 'Manage your club profile.'
              : 'Manage club profiles used across tournaments.'}
          </p>
        </div>
        {admin.isAppAdmin && (
          <button className="btn btn-primary" onClick={handleAddClub}>Add Club</button>
        )}
      </header>

      {err && (
        <div className="error-message" role="status" aria-live="assertive">
          {err}
        </div>
      )}
      {info && (
        <div className="success-message" role="status" aria-live="polite">
          {info}
        </div>
      )}

      <div className="card">
        <div className="overflow-x-auto">
          <table className="table">
            <thead>
              <tr>
                <th className="py-2 pr-2 w-16">Logo</th>
                <SortableTh label="Full Name" onClick={() => clickSortClubs('name')} active={sort.col === 'name'} dir={sort.dir} />
                <SortableTh label="City" onClick={() => clickSortClubs('city')} active={sort.col === 'city'} dir={sort.dir} />
                <SortableTh label="Region" onClick={() => clickSortClubs('region')} active={sort.col === 'region'} dir={sort.dir} />
                <SortableTh label="Country" onClick={() => clickSortClubs('country')} active={sort.col === 'country'} dir={sort.dir} />
                <SortableTh label="Phone" onClick={() => clickSortClubs('phone')} active={sort.col === 'phone'} dir={sort.dir} />
                <th className="py-2 pr-2 w-10"></th>
              </tr>
            </thead>
            <tbody>
              {loading && clubs.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-muted">Loading…</td>
                </tr>
              )}

              {!loading && sortedClubs.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-muted">No clubs yet.</td>
                </tr>
              )}

              {sortedClubs.map((club) => (
                <tr key={club.id}>
                  <td className="py-2 pr-2">
                    {club.logo ? (
                      <img 
                        src={club.logo} 
                        alt={`${club.fullName} logo`}
                        className="w-12 h-8 object-contain"
                      />
                    ) : (
                      <div className="w-12 h-8 bg-gray-100 rounded flex items-center justify-center">
                        <span className="text-gray-400 text-xs">—</span>
                      </div>
                    )}
                  </td>
                  <td className="py-2 pr-4">
                    <button
                      className="text-secondary hover:text-secondary-hover hover:underline"
                      onClick={() => handleEditClub(club)}
                    >
                      {club.fullName}
                    </button>
                  </td>
                  <td className="py-2 pr-4 text-muted">{club.city ?? '—'}</td>
                  <td className="py-2 pr-4 text-muted">{club.region ?? '—'}</td>
                  <td className="py-2 pr-4 text-muted">{club.country ?? '—'}</td>
                  <td className="py-2 pr-4 text-muted">{club.phone ?? '—'}</td>
                  <td className="py-2 pr-2 text-right align-middle">
                    <div className="flex gap-1">
                      <button
                        className="btn btn-sm btn-ghost"
                        onClick={() => handleEditClub(club)}
                        title="Edit"
                      >
                        ✎
                      </button>
                      {admin.isAppAdmin && (
                        <button
                          aria-label="Delete club"
                          onClick={() => removeClub(club.id)}
                          title="Delete"
                          className="text-error hover:text-error-hover p-1"
                        >
                          <TrashIcon />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <GlobalModalManager
        clubs={[]}
        players={players}
        onSavePlayer={async () => {}} // Not used on clubs page
        onSaveClub={handleModalSave}
      />
    </section>
  );

}

function SortableTh({ label, onClick, active, dir }: { label: string; onClick: () => void; active: boolean; dir: 'asc' | 'desc' }) {
  return (
    <th className="py-2 pr-4">
      <button
        className="flex items-center gap-1 text-left font-medium text-gray-700 hover:text-gray-900"
        onClick={onClick}
      >
        {label}
        <span className="text-xs">{active ? (dir === 'asc' ? '↑' : '↓') : '↕'}</span>
      </button>
    </th>
  );
}

function TrashIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M3 6h18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M10 11v6M14 11v6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

