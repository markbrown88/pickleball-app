'use client';
import { SignUp } from '@clerk/nextjs';
import { useSearchParams } from 'next/navigation';
import { useEffect } from 'react';

export default function SignUpPage() {
  const searchParams = useSearchParams();
  const redirectUrl = searchParams.get('redirect_url') || '/dashboard';
  const signInUrl = redirectUrl !== '/dashboard' 
    ? `/sign-in?redirect_url=${encodeURIComponent(redirectUrl)}`
    : '/sign-in';

  useEffect(() => {
    const updateText = () => {
      const title = document.querySelector('[class*="cl-card"] [class*="headerTitle"]');
      const subtitle = document.querySelector('[class*="cl-card"] [class*="headerSubtitle"]');
      
      if (title) {
        (title as HTMLElement).style.display = 'none';
      }
      
      if (subtitle) {
        (subtitle as HTMLElement).textContent = 'Welcome! Please fill in the details to create your account.';
      }
    };

    updateText();
    const observer = new MutationObserver(updateText);
    observer.observe(document.body, { childList: true, subtree: true });

    return () => observer.disconnect();
  }, []);
  
  return (
    <div className="p-6">
      <SignUp 
        signInUrl={signInUrl}
        forceRedirectUrl={redirectUrl}
      />
    </div>
  );
}
