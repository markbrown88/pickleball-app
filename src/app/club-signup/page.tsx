import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import ClubWizard from './components/ClubWizard';
import { prisma } from '@/lib/prisma';

export const metadata = {
    title: 'Club Signup | Klyng Cup',
    description: 'Register your pickleball club to manage tournaments and players',
};

export default async function ClubSignupPage() {
    const { userId } = await auth();

    if (!userId) {
        redirect('/sign-in?redirect_url=/club-signup');
    }

    // Check if user is already a director of any club
    // We fetch this to provide context or redirect if needed
    // But for now, we allow them to create/claim *another* club if they want (multi-club support)
    const user = await prisma.player.findUnique({
        where: { clerkUserId: userId },
        select: {
            id: true,
            name: true,
            email: true,
            // We will need to check the new ClubDirector table once schema is live
            // directors: { include: { club: true } } 
        }
    });

    return (
        <div className="min-h-screen bg-app">
            <div className="max-w-4xl mx-auto px-4 py-12 sm:px-6 lg:px-8">
                <div className="bg-surface-1 shadow rounded-lg overflow-hidden">
                    <div className="bg-brand-primary px-6 py-8">
                        <h1 className="text-3xl font-bold text-white">Club Director Registration</h1>
                        <p className="mt-2 text-brand-primary-foreground opacity-90">
                            Claim your club, manage tournaments, and grow your pickleball community.
                        </p>
                    </div>

                    <div className="p-6">
                        <ClubWizard userId={user?.id} userEmail={user?.email} />
                    </div>
                </div>
            </div>
        </div>
    );
}
