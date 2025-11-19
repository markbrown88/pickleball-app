const DIGIT_REGEX = /\d/g;

function extractDigits(value: string): string {
  return (value.match(DIGIT_REGEX) || []).join('');
}

function formatDigitsToPhone(digits: string): string {
  const clean = digits.slice(0, 10);
  const area = clean.slice(0, 3);
  const central = clean.slice(3, 6);
  const line = clean.slice(6, 10);
  if (clean.length <= 3) {
    return clean;
  }
  if (clean.length <= 6) {
    return `(${area}) ${clean.slice(3)}`;
  }
  return `(${area}) ${central}-${line}`;
}

export function formatPhoneForDisplay(value?: string | null): string {
  if (!value) return '';
  const digits = extractDigits(value);
  if (digits.length === 10 || (digits.length === 11 && digits.startsWith('1'))) {
    const normalized = digits.length === 11 ? digits.slice(1) : digits;
    return formatDigitsToPhone(normalized);
  }
  return value.trim();
}

export function formatPhoneForStorage(
  value?: string | null,
  options?: { strict?: boolean }
): string | null {
  if (!value) return null;
  let digits = extractDigits(value);
  if (digits.length === 11 && digits.startsWith('1')) {
    digits = digits.slice(1);
  }

  if (digits.length === 0) {
    return null;
  }

  if (digits.length !== 10) {
    if (options?.strict) {
      throw new Error('Phone number must contain 10 digits.');
    }
    return value.trim();
  }

  return formatDigitsToPhone(digits);
}

export function formatPhoneInput(value: string): string {
  const digits = extractDigits(value).slice(0, 10);
  if (digits.length === 0) return '';
  if (digits.length <= 3) return digits;
  if (digits.length <= 6) {
    return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
  }
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
}

