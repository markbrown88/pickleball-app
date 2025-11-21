'use client';

import { Gender } from '@prisma/client';

interface GenderSelectorProps {
  value: Gender | '' | null;
  onChange: (value: 'MALE' | 'FEMALE') => void;
  label?: string;
  required?: boolean;
  error?: string;
  className?: string;
}

export function GenderSelector({
  value,
  onChange,
  label,
  required = false,
  error,
  className = '',
}: GenderSelectorProps) {
  const isMale = value === 'MALE';
  const isFemale = value === 'FEMALE';

  return (
    <div className={className}>
      {label && (
        <label className="block text-sm font-semibold text-secondary mb-2">
          {label} {required && <span className="text-error">*</span>}
        </label>
      )}
      <div className={`flex bg-surface-3 rounded-lg p-1 ${error ? 'border border-error' : ''}`}>
        <button
          type="button"
          onClick={() => onChange('MALE')}
          className={`flex-1 py-2 px-3 rounded-md text-sm font-semibold transition-colors ${
            isMale ? 'shadow-sm' : ''
          }`}
          style={{
            backgroundColor: isMale ? 'var(--gender-male)' : 'var(--text-muted)',
            color: isMale ? 'var(--gender-male-text)' : 'var(--brand-primary)',
          }}
          onMouseEnter={(e) => {
            if (!isMale) {
              e.currentTarget.style.backgroundColor = 'var(--surface-2)';
            }
          }}
          onMouseLeave={(e) => {
            if (!isMale) {
              e.currentTarget.style.backgroundColor = 'var(--text-muted)';
            }
          }}
        >
          Male
        </button>
        <button
          type="button"
          onClick={() => onChange('FEMALE')}
          className={`flex-1 py-2 px-3 rounded-md text-sm font-semibold transition-colors ${
            isFemale ? 'shadow-sm' : ''
          }`}
          style={{
            backgroundColor: isFemale ? 'var(--gender-female)' : 'var(--text-muted)',
            color: isFemale ? 'var(--gender-female-text)' : 'var(--brand-primary)',
          }}
          onMouseEnter={(e) => {
            if (!isFemale) {
              e.currentTarget.style.backgroundColor = 'var(--surface-2)';
            }
          }}
          onMouseLeave={(e) => {
            if (!isFemale) {
              e.currentTarget.style.backgroundColor = 'var(--text-muted)';
            }
          }}
        >
          Female
        </button>
      </div>
      {error && <p className="text-xs text-error mt-1">{error}</p>}
    </div>
  );
}

