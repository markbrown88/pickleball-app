import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import ClubWizard from './components/ClubWizard';
import { prisma } from '@/lib/prisma';

export const metadata = {
    title: 'Club Signup | Klyng Cup',
    description: 'Register your pickleball club to manage tournaments and players',
};

export default async function ClubSignupPage() {
    const { userId } = await auth();

    if (!userId) {
        return (
            <div className="min-h-screen bg-app flex flex-col items-center justify-center p-4">
                <div className="max-w-md w-full bg-surface-1 p-8 rounded-2xl shadow-xl border border-subtle text-center">
                    <h1 className="text-3xl font-bold text-primary mb-4">Club Registration</h1>
                    <p className="text-muted mb-8 text-lg">
                        To register and manage a club, you need a Klyng Cup account. Please log in or create an account to continue.
                    </p>
                    <div className="space-y-4">
                        <Link
                            href="/sign-in?redirect_url=/club-signup"
                            className="btn btn-primary w-full justify-center text-lg py-3"
                        >
                            Log In
                        </Link>
                        <div className="pt-2">
                            <Link
                                href="/sign-up?redirect_url=/club-signup"
                                className="btn btn-outline w-full justify-center text-lg py-3"
                            >
                                Create Account
                            </Link>
                        </div>
                    </div>
                </div>
            </div>
        );
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
                        <h1 className="text-3xl font-bold text-white">Club Registration</h1>
                        <p className="mt-2 text-brand-primary-foreground opacity-90">
                            Make sure your club can compete in Klyng Cup events and grow your pickleball community.
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
