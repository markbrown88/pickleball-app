export type RegistrationNotes = {
  stopIds?: string[];
  brackets?: Array<{ stopId: string; bracketId: string; gameTypes?: string[] }>;
  clubId?: string;
  playerInfo?: {
    firstName?: string;
    lastName?: string;
    email?: string;
    phone?: string;
  };
  subtotal?: number;
  tax?: number;
  expectedAmount?: number;
  pricingModel?: string;
  stripeSessionId?: string;
  paymentIntentId?: string;
  newStopsSubtotal?: number;
  newStopsTax?: number;
  newStopsTotal?: number;
  newlySelectedStopIds?: string[];
  newlySelectedBrackets?: Array<{ stopId: string; bracketId: string; gameTypes?: string[] }>;
  paidStops?: Array<{ paymentIntentId: string; stopIds: string[]; paidAt: string }>;
  processedPayments?: Array<{ paymentIntentId: string; amount: number; processedAt: string; source?: string }>;
  refunds?: Array<{ refundId: string; amount: number; reason?: string; refundedAt: string }>;
  reminder12hSent?: boolean;
  reminder12hSentAt?: string;
  [key: string]: unknown;
};

export function parseRegistrationNotes(raw: string | null): RegistrationNotes {
  if (!raw) {
    return {};
  }

  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object') {
      return parsed as RegistrationNotes;
    }
  } catch (err) {
    console.warn('[registrationNotes] Failed to parse notes JSON:', err);
  }

  return {};
}

export function stringifyRegistrationNotes(notes: RegistrationNotes): string {
  return JSON.stringify(notes);
}

export function markPaymentProcessed(
  notes: RegistrationNotes,
  paymentIntentId: string,
  amountInCents: number,
  source: string
): RegistrationNotes {
  const processedPayments = notes.processedPayments || [];

  if (!processedPayments.some((entry) => entry.paymentIntentId === paymentIntentId)) {
    processedPayments.push({
      paymentIntentId,
      amount: amountInCents,
      processedAt: new Date().toISOString(),
      source,
    });
  }

  notes.processedPayments = processedPayments;
  notes.paymentIntentId = paymentIntentId;
  notes.newlySelectedStopIds = [];
  notes.newlySelectedBrackets = [];
  delete notes.newStopsSubtotal;
  delete notes.newStopsTax;
  delete notes.newStopsTotal;

  return notes;
}

export function appendPaidStops(
  notes: RegistrationNotes,
  paymentIntentId: string,
  stopIds: string[]
): RegistrationNotes {
  if (!stopIds.length) {
    return notes;
  }

  const paidStops = notes.paidStops || [];
  paidStops.push({
    paymentIntentId,
    stopIds,
    paidAt: new Date().toISOString(),
  });
  notes.paidStops = paidStops;
  return notes;
}

export function appendRefund(
  notes: RegistrationNotes,
  refundId: string,
  amountInCents: number,
  reason?: string
): RegistrationNotes {
  const refunds = notes.refunds || [];
  refunds.push({
    refundId,
    amount: amountInCents,
    reason,
    refundedAt: new Date().toISOString(),
  });
  notes.refunds = refunds;
  return notes;
}

export function getPendingPaymentAmountInCents(
  notes: RegistrationNotes,
  fallbackAmountInCents = 0
): number {
  if (typeof notes.newStopsTotal === 'number') {
    return Math.round(notes.newStopsTotal * 100);
  }
  if (typeof notes.expectedAmount === 'number') {
    return Math.round(notes.expectedAmount * 100);
  }
  return fallbackAmountInCents;
}

export function getPaidStopIdsForCurrentPayment(notes: RegistrationNotes): string[] {
  if (notes.newlySelectedStopIds && notes.newlySelectedStopIds.length > 0) {
    return Array.from(new Set(notes.newlySelectedStopIds));
  }
  if (notes.stopIds && notes.stopIds.length > 0) {
    return Array.from(new Set(notes.stopIds));
  }
  return [];
}

export function getPaidBracketsForCurrentPayment(
  notes: RegistrationNotes
): Array<{ stopId: string; bracketId: string; gameTypes?: string[] }> {
  if (notes.newlySelectedBrackets && notes.newlySelectedBrackets.length > 0) {
    return notes.newlySelectedBrackets;
  }
  return notes.brackets || [];
}

