import { currentUser } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { OnboardingFlow } from './OnboardingFlow';

export default async function OnboardingPage() {
  const user = await currentUser();

  if (!user) {
    redirect('/sign-in');
  }

  // Get user's player record
  const player = await prisma.player.findUnique({
    where: { clerkUserId: user.id },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
      gender: true,
      clubId: true,
      phone: true,
      city: true,
      region: true,
      country: true,
      birthday: true,
      birthdayYear: true,
      birthdayMonth: true,
      birthdayDay: true,
      duprSingles: true,
      duprDoubles: true,
      clubRatingSingles: true,
      clubRatingDoubles: true,
    },
  });

  if (!player) {
    // Should not happen - webhook should have created player
    redirect('/');
  }

  // Check if profile is already complete
  const isComplete = player.firstName && player.lastName && player.gender && player.clubId;
  if (isComplete) {
    // Profile is complete, redirect to dashboard
    redirect('/dashboard');
  }

  // Get all clubs for selection
  const clubs = await prisma.club.findMany({
    orderBy: { name: 'asc' },
    select: {
      id: true,
      name: true,
      city: true,
      region: true,
    },
  });

  // Get user email from Clerk
  const userEmail = user.emailAddresses?.[0]?.emailAddress || player.email || '';

  return (
    <OnboardingFlow
      player={player}
      userEmail={userEmail}
      clubs={clubs}
    />
  );
}

