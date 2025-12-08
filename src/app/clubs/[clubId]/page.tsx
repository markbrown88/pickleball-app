import { notFound } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import Link from 'next/link';
import { Metadata } from 'next';

export async function generateMetadata({ params }: { params: { clubId: string } }): Promise<Metadata> {
    const club = await prisma.club.findUnique({
        where: { id: params.clubId },
        select: { name: true, fullName: true }
    });

    return {
        title: club ? `${club.fullName || club.name} | Klyng Cup` : 'Club Not Found',
    };
}

export default async function ClubProfilePage({ params }: { params: { clubId: string } }) {
    const { clubId } = params;

    const club = await prisma.club.findUnique({
        where: { id: clubId },
    });

    if (!club) {
        notFound();
    }

    return (
        <div className="max-w-7xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
            <div className="bg-surface-1 shadow rounded-2xl overflow-hidden border border-subtle">
                {/* Header / Cover */}
                <div className="bg-brand-primary h-32 sm:h-48 relative">
                    <div className="absolute inset-0 bg-gradient-to-r from-brand-primary to-brand-secondary opacity-30"></div>
                </div>

                <div className="px-6 pb-6 relative">
                    <div className="-mt-12 mb-4 flex justify-between items-end">
                        <div className="bg-surface-1 p-2 rounded-xl shadow-lg">
                            <div className="w-24 h-24 bg-surface-2 rounded-lg flex items-center justify-center text-4xl overflow-hidden">
                                {club.logo ? (
                                    <img src={club.logo} alt={club.name} className="w-full h-full object-cover" />
                                ) : (
                                    <span>🏠</span>
                                )}
                            </div>
                        </div>
                    </div>

                    <div className="flex justify-between items-start">
                        <div>
                            <h1 className="text-3xl font-bold text-primary">{club.fullName || club.name}</h1>
                            <div className="flex items-center text-muted mt-2 gap-4">
                                {club.city && club.region && (
                                    <div className="flex items-center gap-1">
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                                        </svg>
                                        <span>{club.city}, {club.region}</span>
                                    </div>
                                )}
                                {club.status && (
                                    <span className={`chip ${club.status === 'SUBSCRIBED' ? 'chip-success' : 'chip-info'}`}>
                                        {club.status}
                                    </span>
                                )}
                            </div>
                        </div>
                    </div>

                    {club.description && (
                        <div className="mt-8 max-w-2xl">
                            <h2 className="text-lg font-semibold text-primary mb-2">About</h2>
                            <p className="text-muted leading-relaxed whitespace-pre-line">
                                {club.description}
                            </p>
                        </div>
                    )}

                    {/* Tournaments Section Placeholder */}
                    <div className="mt-12 pt-8 border-t border-subtle">
                        <h2 className="text-xl font-bold text-primary mb-4">Tournaments</h2>
                        <div className="bg-surface-2 rounded-lg p-8 text-center border border-subtle border-dashed">
                            <p className="text-muted">No active tournaments found for this club.</p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
