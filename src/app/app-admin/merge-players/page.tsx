'use client';

import { useState, useCallback } from 'react';

type Player = {
    id: string;
    firstName: string | null;
    lastName: string | null;
    name: string | null;
    email: string | null;
    clerkUserId: string | null;
    club: { id: string; name: string };
};

type MergePreview = {
    lineupEntriesP1: number;
    lineupEntriesP2: number;
    stopTeamPlayers: number;
    teamPlayers: number;
    tournamentRegistrations: number;
    teamsAsCaptain: number;
    captainInvites: number;
    tournamentAdmins: number;
    tournamentCaptains: number;
    tournamentEventManagers: number;
    stopsManaged: number;
    clubDirectors: number;
    matchTiebreakerDecisions: number;
    waitlistEntries: number;
    invitesReceived: number;
    invitesSent: number;
    inviteRequestsSent: number;
    inviteRequestsReviewed: number;
};

type PreviewResponse = {
    primaryPlayer: Player;
    secondaryPlayer: Player;
    preview: MergePreview;
    totalItems: number;
    clerkMergeInfo: string;
};

type MergeResult = {
    success: boolean;
    message: string;
    transferred: Record<string, number>;
    clerkResult: {
        status: string;
        notes?: string;
    };
};

type MergeLog = {
    id: string;
    primaryPlayerId: string;
    secondaryPlayerId: string;
    secondaryPlayerName: string;
    secondaryPlayerEmail: string | null;
    clerkMergeStatus: string | null;
    createdAt: string;
    primaryPlayer: { name: string | null; firstName: string | null; lastName: string | null };
    admin: { name: string | null; firstName: string | null; lastName: string | null };
};

export default function MergePlayersPage() {
    const [primarySearch, setPrimarySearch] = useState('');
    const [secondarySearch, setSecondarySearch] = useState('');
    const [primaryResults, setPrimaryResults] = useState<Player[]>([]);
    const [secondaryResults, setSecondaryResults] = useState<Player[]>([]);
    const [primaryPlayer, setPrimaryPlayer] = useState<Player | null>(null);
    const [secondaryPlayer, setSecondaryPlayer] = useState<Player | null>(null);
    const [preview, setPreview] = useState<PreviewResponse | null>(null);
    const [loading, setLoading] = useState(false);
    const [merging, setMerging] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<MergeResult | null>(null);
    const [showHistory, setShowHistory] = useState(false);
    const [history, setHistory] = useState<MergeLog[]>([]);
    const [historyLoading, setHistoryLoading] = useState(false);

    // Search for players
    const searchPlayers = useCallback(async (term: string, type: 'primary' | 'secondary') => {
        if (term.length < 2) {
            if (type === 'primary') setPrimaryResults([]);
            else setSecondaryResults([]);
            return;
        }

        try {
            const res = await fetch(`/api/admin/players/search?term=${encodeURIComponent(term)}`);
            if (res.ok) {
                const data = await res.json();
                if (type === 'primary') setPrimaryResults(data.items || []);
                else setSecondaryResults(data.items || []);
            }
        } catch (err) {
            console.error('Search failed:', err);
        }
    }, []);

    // Select a player
    const selectPlayer = (player: Player, type: 'primary' | 'secondary') => {
        if (type === 'primary') {
            setPrimaryPlayer(player);
            setPrimarySearch('');
            setPrimaryResults([]);
        } else {
            setSecondaryPlayer(player);
            setSecondarySearch('');
            setSecondaryResults([]);
        }
        setPreview(null);
        setSuccess(null);
        setError(null);
    };

    // Load preview
    const loadPreview = async () => {
        if (!primaryPlayer || !secondaryPlayer) return;

        setLoading(true);
        setError(null);

        try {
            const res = await fetch(
                `/api/app-admin/players/merge?primaryId=${primaryPlayer.id}&secondaryId=${secondaryPlayer.id}`
            );
            const data = await res.json();

            if (!res.ok) {
                setError(data.error || 'Failed to load preview');
                return;
            }

            setPreview(data);
        } catch (err) {
            setError('Failed to load preview');
        } finally {
            setLoading(false);
        }
    };

    // Execute merge
    const executeMerge = async () => {
        if (!primaryPlayer || !secondaryPlayer) return;

        const confirmed = window.confirm(
            `Are you sure you want to merge "${secondaryPlayer.name || secondaryPlayer.firstName}" into "${primaryPlayer.name || primaryPlayer.firstName}"?\n\nThis action CANNOT be undone. The secondary player will be DELETED.`
        );

        if (!confirmed) return;

        setMerging(true);
        setError(null);

        try {
            const res = await fetch('/api/app-admin/players/merge', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    primaryId: primaryPlayer.id,
                    secondaryId: secondaryPlayer.id,
                }),
            });

            const data = await res.json();

            if (!res.ok) {
                setError(data.error || 'Failed to execute merge');
                return;
            }

            setSuccess(data);
            setPrimaryPlayer(null);
            setSecondaryPlayer(null);
            setPreview(null);
        } catch (err) {
            setError('Failed to execute merge');
        } finally {
            setMerging(false);
        }
    };

    // Load history
    const loadHistory = async () => {
        setHistoryLoading(true);
        try {
            const res = await fetch('/api/app-admin/players/merge/history');
            if (res.ok) {
                const data = await res.json();
                setHistory(data.logs || []);
            }
        } catch (err) {
            console.error('Failed to load history:', err);
        } finally {
            setHistoryLoading(false);
        }
    };

    const getDisplayName = (player: Player | { name: string | null; firstName: string | null; lastName: string | null }) => {
        return player.name || `${player.firstName || ''} ${player.lastName || ''}`.trim() || 'Unknown';
    };

    const previewLabels: Record<keyof MergePreview, string> = {
        lineupEntriesP1: 'Lineup entries (as Player 1)',
        lineupEntriesP2: 'Lineup entries (as Player 2)',
        stopTeamPlayers: 'Roster assignments',
        teamPlayers: 'Team memberships',
        tournamentRegistrations: 'Tournament registrations',
        teamsAsCaptain: 'Teams as captain',
        captainInvites: 'Captain invites',
        tournamentAdmins: 'Tournament admin roles',
        tournamentCaptains: 'Tournament captain roles',
        tournamentEventManagers: 'Event manager roles',
        stopsManaged: 'Stops managed',
        clubDirectors: 'Club director roles',
        matchTiebreakerDecisions: 'Match tiebreaker decisions',
        waitlistEntries: 'Waitlist entries',
        invitesReceived: 'Invites received',
        invitesSent: 'Invites sent',
        inviteRequestsSent: 'Invite requests sent',
        inviteRequestsReviewed: 'Invite requests reviewed',
    };

    return (
        <div className="space-y-6">
            <div className="max-w-6xl mx-auto p-6">
                <div className="flex items-center justify-between mb-6">
                    <div>
                        <h1 className="text-2xl font-bold text-primary">Player Merge Tool</h1>
                        <p className="text-muted mt-1">Merge duplicate player accounts</p>
                    </div>
                    <button
                        onClick={() => {
                            setShowHistory(!showHistory);
                            if (!showHistory) loadHistory();
                        }}
                        className="px-4 py-2 rounded-lg border border-border-subtle hover:bg-surface-2 transition-colors"
                    >
                        {showHistory ? 'Hide History' : 'View History'}
                    </button>
                </div>

                {error && (
                    <div className="mb-6 p-4 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400">
                        {error}
                    </div>
                )}

                {success && (
                    <div className="mb-6 p-4 bg-green-500/10 border border-green-500/30 rounded-lg">
                        <h3 className="font-semibold text-green-400 mb-2">✓ Merge Successful</h3>
                        <p className="text-green-300">{success.message}</p>
                        {success.clerkResult.status !== 'SKIPPED' && (
                            <p className="text-sm text-muted mt-2">
                                Clerk: {success.clerkResult.status}
                                {success.clerkResult.notes && ` - ${success.clerkResult.notes}`}
                            </p>
                        )}
                    </div>
                )}

                {showHistory ? (
                    <div className="bg-surface-1 rounded-xl border border-border-subtle p-6">
                        <h2 className="text-lg font-semibold mb-4">Merge History</h2>
                        {historyLoading ? (
                            <p className="text-muted">Loading...</p>
                        ) : history.length === 0 ? (
                            <p className="text-muted">No merge history found.</p>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead>
                                        <tr className="border-b border-border-subtle">
                                            <th className="text-left py-2 px-3">Date</th>
                                            <th className="text-left py-2 px-3">Secondary Player (Deleted)</th>
                                            <th className="text-left py-2 px-3">Merged Into</th>
                                            <th className="text-left py-2 px-3">By</th>
                                            <th className="text-left py-2 px-3">Clerk Status</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {history.map((log) => (
                                            <tr key={log.id} className="border-b border-border-subtle/50">
                                                <td className="py-2 px-3 text-muted">
                                                    {new Date(log.createdAt).toLocaleDateString()}
                                                </td>
                                                <td className="py-2 px-3">
                                                    {log.secondaryPlayerName}
                                                    {log.secondaryPlayerEmail && (
                                                        <span className="text-muted text-xs block">{log.secondaryPlayerEmail}</span>
                                                    )}
                                                </td>
                                                <td className="py-2 px-3">{getDisplayName(log.primaryPlayer)}</td>
                                                <td className="py-2 px-3">{getDisplayName(log.admin)}</td>
                                                <td className="py-2 px-3">
                                                    <span
                                                        className={`px-2 py-0.5 rounded text-xs ${log.clerkMergeStatus === 'SUCCESS'
                                                            ? 'bg-green-500/20 text-green-400'
                                                            : log.clerkMergeStatus === 'SKIPPED'
                                                                ? 'bg-gray-500/20 text-gray-400'
                                                                : 'bg-yellow-500/20 text-yellow-400'
                                                            }`}
                                                    >
                                                        {log.clerkMergeStatus || 'N/A'}
                                                    </span>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                ) : (
                    <div className="grid md:grid-cols-2 gap-6">
                        {/* Primary Player (Keep) */}
                        <div className="bg-surface-1 rounded-xl border border-green-500/30 p-6">
                            <h2 className="text-lg font-semibold text-green-400 mb-4">✓ Keep This Player</h2>

                            {primaryPlayer ? (
                                <div className="space-y-2">
                                    <p className="font-medium text-lg">{getDisplayName(primaryPlayer)}</p>
                                    <p className="text-muted text-sm">{primaryPlayer.email || 'No email'}</p>
                                    <p className="text-muted text-sm">Club: {primaryPlayer.club?.name || 'Unknown'}</p>
                                    <p className="text-sm">
                                        Clerk: {primaryPlayer.clerkUserId ? (
                                            <span className="text-green-400">✓ Has account</span>
                                        ) : (
                                            <span className="text-yellow-400">No account</span>
                                        )}
                                    </p>
                                    <button
                                        onClick={() => setPrimaryPlayer(null)}
                                        className="text-sm text-red-400 hover:text-red-300 mt-2"
                                    >
                                        Clear selection
                                    </button>
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    <input
                                        type="text"
                                        value={primarySearch}
                                        onChange={(e) => {
                                            setPrimarySearch(e.target.value);
                                            searchPlayers(e.target.value, 'primary');
                                        }}
                                        placeholder="Search by name or email..."
                                        className="w-full px-4 py-2 rounded-lg bg-surface-2 border border-border-subtle focus:border-brand-secondary focus:outline-none"
                                    />
                                    {primaryResults.length > 0 && (
                                        <div className="bg-surface-2 rounded-lg border border-border-subtle max-h-48 overflow-y-auto">
                                            {primaryResults.map((player) => (
                                                <button
                                                    key={player.id}
                                                    onClick={() => selectPlayer(player, 'primary')}
                                                    className="w-full text-left px-4 py-2 hover:bg-surface-3 transition-colors border-b border-border-subtle/50 last:border-b-0"
                                                >
                                                    <p className="font-medium">{getDisplayName(player)}</p>
                                                    <p className="text-sm text-muted">{player.email} • {player.club?.name}</p>
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>

                        {/* Secondary Player (Delete) */}
                        <div className="bg-surface-1 rounded-xl border border-red-500/30 p-6">
                            <h2 className="text-lg font-semibold text-red-400 mb-4">✗ Merge From (Delete)</h2>

                            {secondaryPlayer ? (
                                <div className="space-y-2">
                                    <p className="font-medium text-lg">{getDisplayName(secondaryPlayer)}</p>
                                    <p className="text-muted text-sm">{secondaryPlayer.email || 'No email'}</p>
                                    <p className="text-muted text-sm">Club: {secondaryPlayer.club?.name || 'Unknown'}</p>
                                    <p className="text-sm">
                                        Clerk: {secondaryPlayer.clerkUserId ? (
                                            <span className="text-green-400">✓ Has account</span>
                                        ) : (
                                            <span className="text-yellow-400">No account</span>
                                        )}
                                    </p>
                                    <button
                                        onClick={() => setSecondaryPlayer(null)}
                                        className="text-sm text-red-400 hover:text-red-300 mt-2"
                                    >
                                        Clear selection
                                    </button>
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    <input
                                        type="text"
                                        value={secondarySearch}
                                        onChange={(e) => {
                                            setSecondarySearch(e.target.value);
                                            searchPlayers(e.target.value, 'secondary');
                                        }}
                                        placeholder="Search by name or email..."
                                        className="w-full px-4 py-2 rounded-lg bg-surface-2 border border-border-subtle focus:border-brand-secondary focus:outline-none"
                                    />
                                    {secondaryResults.length > 0 && (
                                        <div className="bg-surface-2 rounded-lg border border-border-subtle max-h-48 overflow-y-auto">
                                            {secondaryResults.map((player) => (
                                                <button
                                                    key={player.id}
                                                    onClick={() => selectPlayer(player, 'secondary')}
                                                    className="w-full text-left px-4 py-2 hover:bg-surface-3 transition-colors border-b border-border-subtle/50 last:border-b-0"
                                                >
                                                    <p className="font-medium">{getDisplayName(player)}</p>
                                                    <p className="text-sm text-muted">{player.email} • {player.club?.name}</p>
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* Preview Section */}
                {primaryPlayer && secondaryPlayer && !showHistory && (
                    <div className="mt-6">
                        {!preview ? (
                            <button
                                onClick={loadPreview}
                                disabled={loading}
                                className="w-full py-3 bg-brand-secondary text-brand-secondary-text font-semibold rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50"
                            >
                                {loading ? 'Loading Preview...' : 'Preview Merge'}
                            </button>
                        ) : (
                            <div className="bg-surface-1 rounded-xl border border-border-subtle p-6">
                                <h2 className="text-lg font-semibold mb-4">Preview: What Will Be Transferred</h2>

                                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3 mb-6">
                                    {Object.entries(preview.preview).map(([key, value]) => (
                                        value > 0 && (
                                            <div key={key} className="flex justify-between items-center p-3 bg-surface-2 rounded-lg">
                                                <span className="text-sm">{previewLabels[key as keyof MergePreview]}</span>
                                                <span className="font-semibold text-brand-secondary">{value}</span>
                                            </div>
                                        )
                                    ))}
                                </div>

                                <div className="text-sm text-muted mb-4">
                                    <strong>Total items to transfer:</strong> {preview.totalItems}
                                </div>

                                {/* Clerk Info */}
                                {preview.clerkMergeInfo && (
                                    <div className="p-4 bg-blue-500/10 border border-blue-500/30 rounded-lg mb-6">
                                        <p className="text-sm text-blue-300">
                                            <strong>Clerk Account:</strong> {preview.clerkMergeInfo}
                                        </p>
                                    </div>
                                )}

                                <div className="flex gap-4">
                                    <button
                                        onClick={() => {
                                            setPreview(null);
                                            setPrimaryPlayer(null);
                                            setSecondaryPlayer(null);
                                        }}
                                        className="flex-1 py-3 border border-border-subtle rounded-lg hover:bg-surface-2 transition-colors"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        onClick={executeMerge}
                                        disabled={merging}
                                        className="flex-1 py-3 bg-red-600 text-white font-semibold rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50"
                                    >
                                        {merging ? 'Merging...' : 'Merge Players'}
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
