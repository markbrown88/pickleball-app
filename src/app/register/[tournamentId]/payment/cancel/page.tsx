import { Metadata } from 'next';
import Link from 'next/link';

type PageProps = {
  params: Promise<{ tournamentId: string }>;
};

export const metadata: Metadata = {
  title: 'Payment Cancelled',
  description: 'Your payment was cancelled',
};

export default async function PaymentCancelPage({ params }: PageProps) {
  const { tournamentId } = await params;

  return (
    <div className="min-h-screen bg-surface-1 flex items-center justify-center px-4">
      <div className="max-w-md w-full p-8 bg-surface-2 border border-border-subtle rounded-lg text-center">
        {/* Cancel Icon */}
        <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-warning/20 mb-4">
          <svg
            className="w-12 h-12 text-warning"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </div>

        <h1 className="text-2xl font-bold text-primary mb-2">Payment Cancelled</h1>
        <p className="text-muted mb-6">
          Your payment was cancelled. Your registration has not been completed and no charges
          have been made to your card.
        </p>

        {/* What Happened */}
        <div className="p-4 bg-surface-3 border border-border-subtle rounded text-left mb-6">
          <h3 className="text-sm font-semibold text-secondary mb-2">What happened?</h3>
          <p className="text-sm text-muted">
            You cancelled the payment process or closed the payment window before completing
            your transaction. Your tournament registration is still pending payment.
          </p>
        </div>

        {/* Next Steps */}
        <div className="p-4 bg-primary/5 border border-primary/20 rounded text-left mb-6">
          <h3 className="text-sm font-semibold text-secondary mb-2">What's next?</h3>
          <ul className="text-sm text-muted space-y-1">
            <li>• You can return to the registration page and try again</li>
            <li>• Your registration information has been saved</li>
            <li>• No payment has been processed</li>
          </ul>
        </div>

        {/* Actions */}
        <div className="flex flex-col sm:flex-row gap-3">
          <Link
            href={`/register/${tournamentId}`}
            className="btn btn-primary flex-1"
          >
            Try Again
          </Link>
          <Link
            href="/"
            className="btn btn-ghost flex-1"
          >
            Return Home
          </Link>
        </div>

        {/* Support */}
        <div className="mt-6 text-xs text-muted">
          <p>
            Need help?{' '}
            <a
              href="mailto:support@pickleballtournaments.com"
              className="text-primary hover:underline"
            >
              Contact Support
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
