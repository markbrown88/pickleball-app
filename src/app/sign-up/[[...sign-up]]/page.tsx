'use client';
import { SignUp } from '@clerk/nextjs';
import { useSearchParams } from 'next/navigation';

export default function SignUpPage() {
  const searchParams = useSearchParams();
  const redirectUrl = searchParams.get('redirect_url') || '/onboarding';
  const signInUrl = redirectUrl !== '/onboarding' 
    ? `/sign-in?redirect_url=${encodeURIComponent(redirectUrl)}`
    : '/sign-in';
  
  return (
    <div className="p-6">
      <SignUp 
        signInUrl={signInUrl}
        forceRedirectUrl={redirectUrl}
      />
    </div>
  );
}
