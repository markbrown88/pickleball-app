'use client';

import { useState } from 'react';
import Link from 'next/link';
import { fetchWithActAs } from '@/lib/fetchWithActAs';

type PaymentStatusClientProps = {
  registration: {
    id: string;
    tournamentId: string;
    paymentStatus: string;
    amountPaid: number | null;
    registeredAt: Date;
    withdrawnAt: Date | null;
    notes: string | null;
    tournament: {
      id: string;
      name: string;
      registrationType: string;
    };
    player: {
      firstName: string | null;
      lastName: string | null;
      name: string | null;
      email: string | null;
    };
  };
  stripePayment: {
    status: string;
    amount: number;
    currency: string;
    created: number;
    receipt_url?: string;
  } | null;
  paymentIntentId: string | null;
  purchaseDetails: {
    stops: Array<{ id: string; name: string }>;
    club: { id: string; name: string } | null;
    brackets: Array<{ stopId: string; bracketId: string; bracketName: string }>;
  } | null;
};

export function PaymentStatusClient({ registration, stripePayment, paymentIntentId, purchaseDetails }: PaymentStatusClientProps) {
  const [isRetrying, setIsRetrying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleRetryPayment = async () => {
    setIsRetrying(true);
    setError(null);

    try {
      const response = await fetchWithActAs('/api/payments/retry', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          registrationId: registration.id,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        const errorMsg = data.details 
          ? `${data.error}: ${data.details}`
          : data.error || 'Failed to retry payment';
        setError(errorMsg);
        setIsRetrying(false);
        return;
      }

      // Redirect to Stripe Checkout
      if (data.url) {
        window.location.href = data.url;
      } else {
        setError('Payment session created but no redirect URL provided');
        setIsRetrying(false);
      }
    } catch (err) {
      setError('An unexpected error occurred. Please try again.');
      setIsRetrying(false);
    }
  };

  const paymentStatus = registration.paymentStatus;
  const isPaid = paymentStatus === 'PAID' || paymentStatus === 'COMPLETED';
  const isPending = paymentStatus === 'PENDING';
  const isFailed = paymentStatus === 'FAILED';
  const isRefunded = paymentStatus === 'REFUNDED';

  const amountPaid = registration.amountPaid 
    ? (registration.amountPaid / 100).toFixed(2)
    : '0.00';

  return (
    <div className="min-h-screen bg-surface-1 flex items-center justify-center px-4 py-8">
      <div className="max-w-2xl w-full space-y-6">
        {/* Header */}
        <div className="text-center">
          <h1 className="text-3xl font-bold text-primary mb-2">Payment Status</h1>
          <p className="text-muted">Tournament: {registration.tournament.name}</p>
        </div>

        {/* Status Card */}
        <div className="card">
          <div className="space-y-4">
            {/* Status Badge */}
            <div className="flex items-center justify-center">
              {isPaid && (
                <div className="inline-flex items-center gap-2 px-4 py-2 bg-success/10 text-success rounded-full">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span className="font-semibold">Payment Confirmed</span>
                </div>
              )}
              {isPending && (
                <div className="inline-flex items-center gap-2 px-4 py-2 bg-warning/10 text-warning rounded-full">
                  <svg className="animate-spin w-5 h-5" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  <span className="font-semibold">Payment Pending</span>
                </div>
              )}
              {isFailed && (
                <div className="inline-flex items-center gap-2 px-4 py-2 bg-error/10 text-error rounded-full">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                  <span className="font-semibold">Payment Failed</span>
                </div>
              )}
              {isRefunded && (
                <div className="inline-flex items-center gap-2 px-4 py-2 bg-muted rounded-full">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15l1-4m4 4l1-4m-6 4h.01M19 15h.01" />
                  </svg>
                  <span className="font-semibold">Refunded</span>
                </div>
              )}
            </div>

            {/* Error Message */}
            {error && (
              <div className="p-4 bg-error/10 border border-error/20 rounded-lg">
                <p className="text-sm text-error">{error}</p>
              </div>
            )}

            {/* Payment Details */}
            <div className="space-y-3 pt-4 border-t border-border-subtle">
              <div className="flex justify-between">
                <span className="text-muted">Registration ID:</span>
                <span className="font-mono text-sm">{registration.id}</span>
              </div>
              
              {paymentIntentId && (
                <div className="flex justify-between">
                  <span className="text-muted">Transaction ID:</span>
                  <span className="font-mono text-sm">{paymentIntentId}</span>
                </div>
              )}

              {registration.tournament.registrationType === 'PAID' && (
                <>
                  <div className="flex justify-between">
                    <span className="text-muted">Amount:</span>
                    <span className="font-semibold text-lg">${amountPaid}</span>
                  </div>
                  
                  {stripePayment && (
                    <div className="flex justify-between">
                      <span className="text-muted">Stripe Status:</span>
                      <span className="capitalize">{stripePayment.status}</span>
                    </div>
                  )}
                </>
              )}

              <div className="flex justify-between">
                <span className="text-muted">Registered:</span>
                <span>{new Date(registration.registeredAt).toLocaleDateString()}</span>
              </div>
            </div>

            {/* Purchase Details */}
            {purchaseDetails && (purchaseDetails.stops.length > 0 || purchaseDetails.club || purchaseDetails.brackets.length > 0) && (
              <div className="space-y-3 pt-4 border-t border-border-subtle">
                <h3 className="text-sm font-semibold text-secondary">Registration Details</h3>

                {purchaseDetails.club && (
                  <div className="flex justify-between">
                    <span className="text-muted">Club:</span>
                    <span className="font-medium">{purchaseDetails.club.name}</span>
                  </div>
                )}

                {purchaseDetails.stops.length > 0 && (
                  <div className="flex justify-between items-start">
                    <span className="text-muted">
                      {purchaseDetails.stops.length === 1 ? 'Stop:' : 'Stops:'}
                    </span>
                    <div className="text-right">
                      {purchaseDetails.stops.map((stop, index) => (
                        <div key={stop.id} className="font-medium">
                          {stop.name}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {purchaseDetails.brackets.length > 0 && (
                  <div className="flex justify-between items-start">
                    <span className="text-muted">
                      {purchaseDetails.brackets.length === 1 ? 'Bracket:' : 'Brackets:'}
                    </span>
                    <div className="text-right">
                      {purchaseDetails.brackets.map((bracket, index) => (
                        <div key={`${bracket.stopId}-${bracket.bracketId}`} className="font-medium">
                          {bracket.bracketName}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {registration.withdrawnAt && (
              <div className="space-y-3 pt-4 border-t border-border-subtle">
                <div className="flex justify-between">
                  <span className="text-muted">Withdrawn:</span>
                  <span>{new Date(registration.withdrawnAt).toLocaleDateString()}</span>
                </div>
              </div>
            )}

            {/* Actions */}
            {(isPending || isFailed) && (
              <div className="pt-4 border-t border-border-subtle">
                <p className="text-sm text-muted mb-4">
                  {isPending 
                    ? 'Your payment is being processed. This page will update automatically when payment is confirmed.'
                    : 'Your payment could not be processed. You can retry payment below.'}
                </p>
                <div className="flex gap-3">
                  <button
                    onClick={handleRetryPayment}
                    disabled={isRetrying}
                    className="btn btn-primary flex-1"
                  >
                    {isRetrying ? (
                      <>
                        <svg className="animate-spin -ml-1 mr-3 h-5 w-5" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                        </svg>
                        Processing...
                      </>
                    ) : (
                      'Retry Payment'
                    )}
                  </button>
                  <button
                    onClick={() => {
                      if (typeof window !== 'undefined') {
                        window.location.reload();
                      }
                    }}
                    className="btn btn-ghost"
                    disabled={isRetrying}
                  >
                    Refresh Status
                  </button>
                </div>
              </div>
            )}

            {isPaid && (
              <div className="pt-4 border-t border-border-subtle space-y-3">
                <p className="text-sm text-success">
                  ✓ Your payment has been confirmed. Your registration is complete!
                </p>
                {stripePayment?.receipt_url && (
                  <a
                    href={stripePayment.receipt_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn btn-ghost w-full"
                  >
                    Download Receipt
                  </a>
                )}
                <div className="flex gap-3">
                  <Link
                    href={`/register/${registration.tournamentId}/confirmation?registrationId=${registration.id}`}
                    className="btn btn-primary flex-1"
                  >
                    View Registration
                  </Link>
                  <Link
                    href="/dashboard"
                    className="btn btn-ghost flex-1"
                  >
                    Go to Dashboard
                  </Link>
                </div>
              </div>
            )}

            {isRefunded && (
              <div className="pt-4 border-t border-border-subtle">
                <p className="text-sm text-muted mb-4">
                  This payment has been refunded. If you have questions, please contact support.
                </p>
                <Link
                  href="/support"
                  className="btn btn-primary w-full"
                >
                  Contact Support
                </Link>
              </div>
            )}
          </div>
        </div>

        {/* Auto-refresh for pending payments */}
        {isPending && (
          <meta httpEquiv="refresh" content="10" />
        )}
      </div>
    </div>
  );
}

