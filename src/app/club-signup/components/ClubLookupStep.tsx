'use client';

import { useState } from 'react';
import { ClubData } from './ClubWizard';

interface ClubLookupStepProps {
    onNext: (data: ClubData) => void;
}

type SearchResult = {
    id: string;
    name: string;
    city: string;
    region: string;
    isClaimable: boolean;
};

export default function ClubLookupStep({ onNext }: ClubLookupStepProps) {
    const [searchTerm, setSearchTerm] = useState('');
    const [results, setResults] = useState<SearchResult[]>([]);
    const [isSearching, setIsSearching] = useState(false);
    const [hasSearched, setHasSearched] = useState(false);

    // Simple manual search for now to avoid hook dependency issues if missing
    const handleSearch = async (term: string) => {
        if (term.length < 3) return;
        setIsSearching(true);
        try {
            // Mocking API call for now - will implement API next
            const res = await fetch(`/api/clubs/search?q=${encodeURIComponent(term)}`);
            if (res.ok) {
                const data = await res.json();
                setResults(data.clubs);
            }
        } catch (error) {
            console.error('Search failed', error);
        } finally {
            setIsSearching(false);
            setHasSearched(true);
        }
    };

    return (
        <div className="space-y-6">
            <div className="text-center space-y-2">
                <h2 className="text-2xl font-bold text-primary">Find Your Club</h2>
                <p className="text-muted">Search for your pickleball club to claim it. If it doesn't exist, you can create it.</p>
            </div>

            <div className="max-w-md mx-auto">
                <div className="flex gap-2">
                    <input
                        type="text"
                        className="input flex-1"
                        placeholder="Search by club name..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleSearch(searchTerm)}
                    />
                    <button
                        className="btn btn-primary"
                        onClick={() => handleSearch(searchTerm)}
                        disabled={isSearching || searchTerm.length < 3}
                    >
                        {isSearching ? '...' : 'Search'}
                    </button>
                </div>
            </div>

            <div className="space-y-4 max-w-2xl mx-auto mt-8">
                {hasSearched && results.length === 0 && (
                    <div className="text-center p-8 bg-surface-2 rounded-lg border border-dashed border-subtle">
                        <p className="text-muted mb-4">No clubs found matching "{searchTerm}"</p>
                        <button
                            className="btn btn-secondary"
                            onClick={() => onNext({ name: searchTerm, city: '', region: '', isNew: true })}
                        >
                            + Create New Club "{searchTerm}"
                        </button>
                    </div>
                )}

                {results.map((club) => (
                    <div key={club.id} className="flex items-center justify-between p-4 bg-surface-1 border border-subtle rounded-lg hover:border-brand-primary transition-colors">
                        <div>
                            <h3 className="font-bold text-lg text-primary">{club.name}</h3>
                            <p className="text-sm text-muted">{club.city}, {club.region}</p>
                        </div>
                        <div>
                            {club.isClaimable ? (
                                <button
                                    className="btn btn-outline-primary"
                                    onClick={() => onNext({ id: club.id, name: club.name, city: club.city, region: club.region, isNew: false })}
                                >
                                    Claim Club
                                </button>
                            ) : (
                                <span className="px-3 py-1 bg-gray-100 text-gray-500 rounded text-sm font-medium">
                                    Already Registered
                                </span>
                            )}
                        </div>
                    </div>
                ))}

                {/* Always show create option if search has happened */}
                {hasSearched && results.length > 0 && (
                    <div className="text-center pt-4 border-t border-subtle">
                        <p className="text-sm text-muted mb-2">Don't see your club?</p>
                        <button
                            className="btn btn-ghost text-brand-primary"
                            onClick={() => onNext({ name: searchTerm, city: '', region: '', isNew: true })}
                        >
                            Create "{searchTerm}" as a new club
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}
