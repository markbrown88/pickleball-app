'use client';

import { useState, useEffect } from 'react';
import { useDebounce } from '@/hooks/useDebounce';
import { ClubData } from './ClubWizard';

interface ClubLookupStepProps {
    onNext: (data: ClubData) => void;
    existingSelection?: ClubData | null;
    onClearSelection?: () => void;
}

type SearchResult = {
    id: string;
    name: string;
    city: string;
    region: string;
    isClaimable: boolean;
};

export default function ClubLookupStep({ onNext, existingSelection, onClearSelection }: ClubLookupStepProps) {
    const [searchTerm, setSearchTerm] = useState('');
    const [results, setResults] = useState<SearchResult[]>([]);
    const [isSearching, setIsSearching] = useState(false);
    const [hasSearched, setHasSearched] = useState(false);

    // Auto-search (debounced)
    const debouncedSearchTerm = useDebounce(searchTerm, 500);

    useEffect(() => {
        if (debouncedSearchTerm.length >= 3) {
            handleSearch(debouncedSearchTerm);
        } else if (debouncedSearchTerm.length === 0) {
            setResults([]);
            setHasSearched(false);
        }
    }, [debouncedSearchTerm]);

    const handleSearch = async (term: string) => {
        if (term.length < 3) return;
        setIsSearching(true);
        try {
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

    // If user already has a saved club selection, show continue UI
    if (existingSelection && existingSelection.id && !existingSelection.isNew) {
        return (
            <div className="space-y-6">
                <div className="text-center space-y-2">
                    <h2 className="text-2xl font-bold text-primary">Continue with Your Club</h2>
                    <p className="text-muted max-w-xl mx-auto">
                        You've already started registration for this club.
                    </p>
                </div>

                <div className="max-w-md mx-auto bg-surface-2 rounded-xl p-6 border border-subtle">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-brand-secondary/20 rounded-lg flex items-center justify-center text-2xl flex-shrink-0">
                            🏠
                        </div>
                        <div className="flex-1 min-w-0">
                            <h3 className="font-bold text-primary truncate">{existingSelection.name}</h3>
                            {existingSelection.city && existingSelection.region && (
                                <p className="text-sm text-muted">{existingSelection.city}, {existingSelection.region}</p>
                            )}
                        </div>
                    </div>
                </div>

                <div className="flex flex-col sm:flex-row gap-4 justify-center max-w-md mx-auto">
                    <button
                        className="btn btn-secondary flex-1 py-3"
                        onClick={() => onNext(existingSelection)}
                    >
                        Continue Setup
                    </button>
                    <button
                        className="btn btn-ghost flex-1 py-3"
                        onClick={onClearSelection}
                    >
                        Choose Different Club
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="text-center space-y-2">
                <h2 className="text-2xl font-bold text-primary">Find Your Club</h2>
                <p className="text-muted max-w-xl mx-auto mb-6">
                    Search for your pickleball club below to get started.
                </p>

                <div className="max-w-xl mx-auto grid sm:grid-cols-2 gap-4 mb-4">
                    <div className="bg-surface-2/50 border border-subtle p-4 rounded-lg text-left hover:border-brand-secondary/50 transition-colors">
                        <div className="flex items-start gap-3">
                            <div className="mt-0.5 bg-brand-secondary/10 p-1.5 rounded-full text-brand-secondary flex-shrink-0">
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                            </div>
                            <div>
                                <span className="font-semibold text-primary block text-sm">Already Listed?</span>
                                <span className="text-xs text-muted block mt-0.5 leading-relaxed">
                                    If your club is registered but without a Director, you can <strong>claim it</strong>.
                                </span>
                            </div>
                        </div>
                    </div>

                    <div className="bg-surface-2/50 border border-subtle p-4 rounded-lg text-left hover:border-brand-secondary/50 transition-colors">
                        <div className="flex items-start gap-3">
                            <div className="mt-0.5 bg-brand-primary/10 p-1.5 rounded-full text-brand-primary flex-shrink-0">
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                                </svg>
                            </div>
                            <div>
                                <span className="font-semibold text-primary block text-sm">Not Found?</span>
                                <span className="text-xs text-muted block mt-0.5 leading-relaxed">
                                    If your club is not yet registered, you can <strong>create it</strong> now.
                                </span>
                            </div>
                        </div>
                    </div>
                </div>
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
                                    className="btn btn-secondary"
                                    onClick={() => onNext({ id: club.id, name: club.name, city: club.city, region: club.region, isNew: false })}
                                >
                                    Claim Club
                                </button>
                            ) : (
                                <span className="chip chip-info">
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
                            className="btn btn-secondary"
                            onClick={() => onNext({ name: searchTerm, city: '', region: '', isNew: true })}
                        >
                            Register it now
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}
