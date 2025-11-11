'use client';

type ConfirmationStepProps = {
  tournamentId: string;
  tournamentName: string;
  playerName: string;
  email: string;
  registrationId?: string;
  isFree: boolean;
};

export function ConfirmationStep({
  tournamentId,
  tournamentName,
  playerName,
  email,
  registrationId,
  isFree,
}: ConfirmationStepProps) {
  return (
    <div className="min-h-screen bg-surface-1 flex items-center justify-center px-4">
      <div className="max-w-2xl w-full">
        {/* Success Icon */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-success/20 mb-4">
            <svg
              className="w-12 h-12 text-success"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M5 13l4 4L19 7"
              />
            </svg>
          </div>
          <h1 className="text-3xl font-bold text-primary mb-2">Registration Complete!</h1>
          <p className="text-lg text-secondary">
            Thank you for registering for {tournamentName}
          </p>
        </div>

        {/* Confirmation Card */}
        <div className="bg-surface-2 border border-border-subtle rounded-lg p-6 space-y-6">
          {/* Confirmation Details */}
          <div className="space-y-4">
            <div className="flex items-start gap-3">
              <svg
                className="w-6 h-6 text-success flex-shrink-0 mt-0.5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                />
              </svg>
              <div>
                <div className="text-sm text-muted">Registered Player</div>
                <div className="text-lg font-medium text-secondary">{playerName}</div>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <svg
                className="w-6 h-6 text-success flex-shrink-0 mt-0.5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                />
              </svg>
              <div>
                <div className="text-sm text-muted">Confirmation Email Sent To</div>
                <div className="text-lg font-medium text-secondary">{email}</div>
              </div>
            </div>

            {registrationId && (
              <div className="flex items-start gap-3">
                <svg
                  className="w-6 h-6 text-success flex-shrink-0 mt-0.5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                  />
                </svg>
                <div>
                  <div className="text-sm text-muted">Registration ID</div>
                  <div className="text-lg font-mono font-medium text-secondary">
                    {registrationId}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Divider */}
          <div className="border-t border-border-subtle" />

          {/* What's Next */}
          <div className="space-y-3">
            <h3 className="text-lg font-semibold text-secondary">What's Next?</h3>
            <ul className="space-y-2 text-sm text-secondary">
              <li className="flex items-start gap-2">
                <svg
                  className="w-5 h-5 text-primary flex-shrink-0 mt-0.5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 5l7 7-7 7"
                  />
                </svg>
                <span>
                  Check your email for a confirmation message with all your registration details
                </span>
              </li>
              <li className="flex items-start gap-2">
                <svg
                  className="w-5 h-5 text-primary flex-shrink-0 mt-0.5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 5l7 7-7 7"
                  />
                </svg>
                <span>
                  You'll receive tournament updates and match schedules as they become available
                </span>
              </li>
              <li className="flex items-start gap-2">
                <svg
                  className="w-5 h-5 text-primary flex-shrink-0 mt-0.5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 5l7 7-7 7"
                  />
                </svg>
                <span>
                  Make sure to arrive at least 30 minutes before your first scheduled match
                </span>
              </li>
              {!isFree && (
                <li className="flex items-start gap-2">
                  <svg
                    className="w-5 h-5 text-primary flex-shrink-0 mt-0.5"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 5l7 7-7 7"
                    />
                  </svg>
                  <span>Your payment receipt has been sent to your email</span>
                </li>
              )}
            </ul>
          </div>

          {/* Divider */}
          <div className="border-t border-border-subtle" />

          {/* Important Info */}
          <div className="p-4 bg-warning/10 border border-warning/30 rounded">
            <div className="flex items-start gap-3">
              <svg
                className="w-5 h-5 text-warning flex-shrink-0 mt-0.5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              <div>
                <div className="text-sm font-semibold text-warning mb-1">Important</div>
                <p className="text-sm text-secondary">
                  If you need to make changes to your registration or have any questions, please
                  contact the tournament organizer. Save your registration ID for reference.
                </p>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex flex-col sm:flex-row gap-3 pt-4">
            <a
              href={`/tournament/${tournamentId}`}
              className="btn btn-ghost flex-1"
            >
              View Tournament Details
            </a>
            <a href="/dashboard" className="btn btn-primary flex-1">
              Return to Dashboard
            </a>
          </div>
        </div>

        {/* Support Info */}
        <div className="mt-8 text-center text-sm text-muted">
          <p>
            Need help? Contact us at{' '}
            <a href="mailto:support@pickleballtournaments.com" className="text-primary hover:underline">
              support@pickleballtournaments.com
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
