'use client';

import type { UserProfile } from '@/types';
import { formatPhoneForDisplay } from '@/lib/phone';

export function ProfileSummary({ profile }: { profile: UserProfile | null }) {
  if (!profile) return null;

  return (
    <section className="grid gap-4 rounded-2xl border border-subtle bg-surface-1 p-6 md:grid-cols-3">
      <div>
        <h3 className="text-sm font-medium text-muted">Club</h3>
        <p className="text-primary font-semibold">
          {profile.club?.name ?? 'No club assigned'}
        </p>
        {profile.club?.city && (
          <p className="text-sm text-muted">{profile.club.city}</p>
        )}
      </div>
      <div>
        <h3 className="text-sm font-medium text-muted">Contact</h3>
        <p className="text-sm text-muted">{profile.email ?? 'No email provided'}</p>
        <p className="text-sm text-muted">
          {formatPhoneForDisplay(profile.phone) || 'No phone provided'}
        </p>
      </div>
      <div>
        <h3 className="text-sm font-medium text-muted">Location</h3>
        <p className="text-sm text-muted">
          {[profile.city, profile.region, profile.country].filter(Boolean).join(', ') || 'No location provided'}
        </p>
      </div>
    </section>
  );
}

