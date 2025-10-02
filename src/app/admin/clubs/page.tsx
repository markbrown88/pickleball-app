'use client';

import { useEffect, useMemo, useState } from 'react';

import { useAdminUser } from '../AdminContext';

const CA_PROVINCES = ['AB','BC','MB','NB','NL','NS','NT','NU','ON','PE','QC','SK','YT'] as const;
const US_STATES = [
  'AL','AK','AZ','AR','CA','CO','CT','DE','FL','GA','HI','ID','IL','IN','IA','KS','KY','LA','ME',
  'MD','MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ','NM','NY','NC','ND','OH','OK','OR','PA',
  'RI','SC','SD','TN','TX','UT','VT','VA','WA','WV','WI','WY'
] as const;

type Id = string;

type Club = {
  id: Id;
  name: string;
  address?: string | null;
  city?: string | null;
  region?: string | null;
  country: string;
  phone?: string | null;
};

type ClubsResponse = Club[];

function extractErrorMessage(body: unknown, status: number): string {
  if (typeof body === 'string') return body;
  if (body && typeof body === 'object' && 'error' in body && typeof (body as { error?: unknown }).error === 'string') {
    return (body as { error: string }).error;
  }
  return `HTTP ${status}`;
}

async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  const isJson = res.headers.get('content-type')?.includes('application/json');
  const body = isJson ? await res.json() : await res.text();
  if (!res.ok) {
    throw new Error(extractErrorMessage(body, res.status));
  }
  return body as T;
}

export default function AdminClubsPage() {
  const admin = useAdminUser();
  const [clubs, setClubs] = useState<Club[]>([]);
  const [sort, setSort] = useState<{ col: 'name' | 'city' | 'region' | 'country' | 'phone'; dir: 'asc' | 'desc' }>({ col: 'name', dir: 'asc' });
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const [editId, setEditId] = useState<Id | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [countrySel, setCountrySel] = useState<'Canada' | 'USA' | 'Other'>('Canada');
  const [countryOther, setCountryOther] = useState('');
  const [form, setForm] = useState({ name: '', address: '', city: '', region: '', phone: '', country: 'Canada' });

  useEffect(() => {
    if (!admin.isAppAdmin) return;
    void loadClubs(sort);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [admin.isAppAdmin]);

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

  function openCreate() {
    setIsCreating(true);
    setEditId(null);
    setCountrySel('Canada');
    setCountryOther('');
    setForm({ name: '', address: '', city: '', region: '', phone: '', country: 'Canada' });
  }

  function openEdit(club: Club) {
    setIsCreating(false);
    setEditId(club.id);
    const detected = (club.country || 'Canada').trim();
    if (detected === 'Canada' || detected === 'USA') {
      setCountrySel(detected as 'Canada' | 'USA');
      setCountryOther('');
    } else {
      setCountrySel('Other');
      setCountryOther(detected);
    }
    setForm({
      name: club.name || '',
      address: club.address || '',
      city: club.city || '',
      region: club.region || '',
      phone: club.phone || '',
      country: detected,
    });
  }

  function closeEditor() {
    setIsCreating(false);
    setEditId(null);
  }

  async function saveClub() {
    try {
      setErr(null);
      const country = countrySel === 'Other' ? (countryOther || '') : countrySel;
      const payload = {
        name: form.name.trim(),
        address: form.address.trim(),
        city: form.city.trim(),
        region: form.region.trim(),
        phone: form.phone.trim(),
        country,
      };

      if (!payload.name) {
        throw new Error('Club name is required');
      }

      const endpoint = isCreating
        ? '/api/admin/clubs'
        : `/api/admin/clubs/${editId}`;

      await api(endpoint, {
        method: isCreating ? 'POST' : 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      setInfo(isCreating ? 'Club created' : 'Club updated');
      closeEditor();
      await loadClubs(sort);
    } catch (e) {
      setErr((e as Error).message);
    }
  }

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

  if (!admin.isAppAdmin) {
    return (
      <section className="space-y-6">
        <h1 className="text-2xl font-semibold text-primary">Clubs</h1>
        <div className="card">
          <p className="text-muted">Only application administrators can manage clubs.</p>
        </div>
      </section>
    );
  }

  return (
    <section className="space-y-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-primary">Clubs</h1>
          <p className="text-muted">Manage club profiles used across tournaments.</p>
        </div>
        <button className="btn btn-primary" onClick={openCreate}>Add Club</button>
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
                <th>Name</th>
                <th>City</th>
                <th>Region</th>
                <th>Country</th>
                <th>Phone</th>
                <th className="py-2 pr-2 w-10"></th>
              </tr>
            </thead>
            <tbody>
              {loading && clubs.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-muted">Loading…</td>
                </tr>
              )}

              {!loading && sortedClubs.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-muted">No clubs yet.</td>
                </tr>
              )}

              {sortedClubs.map((club) => (
                <tr key={club.id}>
                  <td className="py-2 pr-4">
                    {editId === club.id ? (
                      <input
                        className="input text-sm"
                        value={form.name}
                        onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
                        autoFocus
                      />
                    ) : (
                      <button
                        className="text-secondary hover:text-secondary-hover hover:underline"
                        onClick={() => openEdit(club)}
                      >
                        {club.name}
                      </button>
                    )}
                  </td>
                  <td className="py-2 pr-4 text-muted">
                    {editId === club.id ? (
                      <input
                        className="input text-sm"
                        placeholder="City"
                        value={form.city}
                        onChange={(e) => setForm((prev) => ({ ...prev, city: e.target.value }))}
                      />
                    ) : (
                      club.city ?? '—'
                    )}
                  </td>
                  <td className="py-2 pr-4 text-muted">
                    {editId === club.id ? renderRegionInput() : (club.region ?? '—')}
                  </td>
                  <td className="py-2 pr-4 text-muted">
                    {editId === club.id ? renderCountryInput() : (club.country ?? '—')}
                  </td>
                  <td className="py-2 pr-4 text-muted">
                    {editId === club.id ? (
                      <input
                        className="input text-sm"
                        placeholder="Phone"
                        value={form.phone}
                        onChange={(e) => setForm((prev) => ({ ...prev, phone: e.target.value }))}
                      />
                    ) : (
                      club.phone ?? '—'
                    )}
                  </td>
                  <td className="py-2 pr-2 text-right align-middle">
                    {editId === club.id ? (
                      <div className="flex gap-1">
                        <button className="btn btn-sm btn-primary" onClick={saveClub} title="Save">✓</button>
                        <button className="btn btn-sm btn-ghost" onClick={closeEditor} title="Cancel">✕</button>
                      </div>
                    ) : (
                      <button
                        aria-label="Delete club"
                        onClick={() => removeClub(club.id)}
                        title="Delete"
                        className="text-error hover:text-error-hover p-1"
                      >
                        <TrashIcon />
                      </button>
                    )}
                  </td>
                </tr>
              ))}

              {isCreating && renderCreateRow()}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );

  function renderCountryInput() {
    return (
      <div className="space-y-2">
        <select
          className="input text-sm"
          value={countrySel}
          onChange={(e) => {
            const value = e.target.value as typeof countrySel;
            setCountrySel(value);
            setCountryOther(value === 'Other' ? countryOther : '');
            setForm((prev) => ({ ...prev, country: value === 'Other' ? prev.country : value }));
          }}
        >
          <option value="Canada">Canada</option>
          <option value="USA">USA</option>
          <option value="Other">Other</option>
        </select>
        {countrySel === 'Other' && (
          <input
            className="input text-sm"
            placeholder="Country"
            value={countryOther}
            onChange={(e) => {
              setCountryOther(e.target.value);
              setForm((prev) => ({ ...prev, country: e.target.value }));
            }}
          />
        )}
      </div>
    );
  }

  function renderRegionInput() {
    const { region } = form;
    if (countrySel === 'Canada') {
      return (
        <select className="input text-sm" value={region} onChange={(e) => setForm((prev) => ({ ...prev, region: e.target.value }))}>
          <option value="">Province…</option>
          {CA_PROVINCES.map((p) => (
            <option key={p} value={p}>{p}</option>
          ))}
        </select>
      );
    }
    return (
      <select className="input text-sm" value={region} onChange={(e) => setForm((prev) => ({ ...prev, region: e.target.value }))}>
        <option value="">State…</option>
        {US_STATES.map((s) => (
          <option key={s} value={s}>{s}</option>
        ))}
      </select>
    );
  }

  function renderCreateRow() {
    return (
      <tr>
        <td className="py-2 pr-4">
          <input
            className="input text-sm"
            value={form.name}
            onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
            placeholder="Club Name"
          />
        </td>
        <td className="py-2 pr-4">
          <input
            className="input text-sm"
            value={form.city}
            onChange={(e) => setForm((prev) => ({ ...prev, city: e.target.value }))}
            placeholder="City"
          />
        </td>
        <td className="py-2 pr-4">
          {renderRegionInput()}
        </td>
        <td className="py-2 pr-4">
          {renderCountryInput()}
        </td>
        <td className="py-2 pr-4">
          <input
            className="input text-sm"
            value={form.phone}
            onChange={(e) => setForm((prev) => ({ ...prev, phone: e.target.value }))}
            placeholder="Phone"
          />
        </td>
        <td className="py-2 pr-2 text-right align-middle">
          <div className="flex gap-1">
            <button className="btn btn-sm btn-primary" onClick={saveClub} title="Save">✓</button>
            <button className="btn btn-sm btn-ghost" onClick={closeEditor} title="Cancel">✕</button>
          </div>
        </td>
      </tr>
    );
  }
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