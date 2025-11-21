'use client';

import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth, useUser } from '@clerk/nextjs';
import { fetchWithActAs } from '@/lib/fetchWithActAs';

const PROFILE_ENDPOINT = '/api/auth/user';

/**
 * Client-side guard to ensure profile is complete before accessing player routes
 * This works alongside the server-side check in the layout
 */
export function ProfileGuard({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { isSignedIn } = useAuth();
  const { isLoaded: userLoaded } = useUser();

  useEffect(() => {
    if (!userLoaded || !isSignedIn) return;

    // Allow access to profile and onboarding pages even if incomplete
    if (pathname?.includes('/profile') || pathname?.includes('/onboarding')) {
      return;
    }

    // Check if profile is complete
    const checkProfile = async () => {
      try {
        const response = await fetchWithActAs(PROFILE_ENDPOINT);
        if (response.ok) {
          const profile: { firstName?: string | null; lastName?: string | null; gender?: 'MALE' | 'FEMALE' | null; club?: { id: string } | null } = await response.json();
          
          // Minimum required: firstName, lastName, gender, and clubId
          const profileIncomplete = !profile.firstName || !profile.lastName || !profile.gender || !profile.club;
          
          if (profileIncomplete) {
            router.push('/onboarding');
          }
        }
      } catch (error) {
        console.error('Error checking profile completion:', error);
      }
    };

    void checkProfile();
  }, [pathname, isSignedIn, userLoaded, router]);

  return <>{children}</>;
}


