'use client';
import { SignIn } from '@clerk/nextjs';
import { useSearchParams } from 'next/navigation';

export default function SignInPage() {
  const searchParams = useSearchParams();
  const redirectUrl = searchParams.get('redirect_url') || '/dashboard';
  const signUpUrl = redirectUrl !== '/dashboard'
    ? `/sign-up?redirect_url=${encodeURIComponent(redirectUrl)}`
    : '/sign-up';
  
  return (
    <div className="p-6">
      <SignIn 
        signUpUrl={signUpUrl}
        fallbackRedirectUrl={redirectUrl}
      />
    </div>
  );
}
