import dynamic from 'next/dynamic';

// Dynamically import registration form to reduce initial bundle
const ClubRegistrationClient = dynamic(() => import('./ClubRegistrationClient'), {
  loading: () => (
    <div className="min-h-screen bg-app flex items-center justify-center">
      <div className="flex items-center gap-3">
        <div className="loading-spinner" />
        <span className="text-muted">Loading registration form...</span>
      </div>
    </div>
  ),
  ssr: false
});

export default function ClubRegistrationPage() {
  return <ClubRegistrationClient />;
}
