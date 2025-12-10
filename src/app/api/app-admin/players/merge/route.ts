import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/prisma';
import { mergeClerkAccounts, type ClerkMergeResult } from '@/lib/clerkAdmin';

export const dynamic = 'force-dynamic';

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

/**
 * GET /api/app-admin/players/merge
 * Preview what will be transferred when merging two players
 * Query params: primaryId, secondaryId
 */
export async function GET(req: NextRequest) {
    try {
        const { userId } = await auth();
        if (!userId) {
            return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
        }

        // Verify user is app admin
        const admin = await prisma.player.findUnique({
            where: { clerkUserId: userId },
            select: { id: true, isAppAdmin: true },
        });

        if (!admin?.isAppAdmin) {
            return NextResponse.json({ error: 'App admin access required' }, { status: 403 });
        }

        const { searchParams } = new URL(req.url);
        const primaryId = searchParams.get('primaryId');
        const secondaryId = searchParams.get('secondaryId');

        if (!primaryId || !secondaryId) {
            return NextResponse.json({ error: 'Both primaryId and secondaryId are required' }, { status: 400 });
        }

        if (primaryId === secondaryId) {
            return NextResponse.json({ error: 'Cannot merge a player with themselves' }, { status: 400 });
        }

        // Fetch both players
        const [primaryPlayer, secondaryPlayer] = await Promise.all([
            prisma.player.findUnique({
                where: { id: primaryId },
                select: {
                    id: true,
                    firstName: true,
                    lastName: true,
                    name: true,
                    email: true,
                    clerkUserId: true,
                    club: { select: { id: true, name: true } },
                },
            }),
            prisma.player.findUnique({
                where: { id: secondaryId },
                select: {
                    id: true,
                    firstName: true,
                    lastName: true,
                    name: true,
                    email: true,
                    clerkUserId: true,
                    club: { select: { id: true, name: true } },
                },
            }),
        ]);

        if (!primaryPlayer) {
            return NextResponse.json({ error: 'Primary player not found' }, { status: 404 });
        }
        if (!secondaryPlayer) {
            return NextResponse.json({ error: 'Secondary player not found' }, { status: 404 });
        }

        // Count what will be transferred
        const [
            lineupEntriesP1,
            lineupEntriesP2,
            stopTeamPlayers,
            teamPlayers,
            tournamentRegistrations,
            teamsAsCaptain,
            captainInvites,
            tournamentAdmins,
            tournamentCaptains,
            tournamentEventManagers,
            stopsManaged,
            clubDirectors,
            matchTiebreakerDecisions,
            waitlistEntries,
            invitesReceived,
            invitesSent,
            inviteRequestsSent,
            inviteRequestsReviewed,
        ] = await Promise.all([
            prisma.lineupEntry.count({ where: { player1Id: secondaryId } }),
            prisma.lineupEntry.count({ where: { player2Id: secondaryId } }),
            prisma.stopTeamPlayer.count({ where: { playerId: secondaryId } }),
            prisma.teamPlayer.count({ where: { playerId: secondaryId } }),
            prisma.tournamentRegistration.count({ where: { playerId: secondaryId } }),
            prisma.team.count({ where: { captainId: secondaryId } }),
            prisma.captainInvite.count({ where: { captainId: secondaryId } }),
            prisma.tournamentAdmin.count({ where: { playerId: secondaryId } }),
            prisma.tournamentCaptain.count({ where: { playerId: secondaryId } }),
            prisma.tournamentEventManager.count({ where: { playerId: secondaryId } }),
            prisma.stop.count({ where: { eventManagerId: secondaryId } }),
            prisma.clubDirector.count({ where: { playerId: secondaryId } }),
            prisma.match.count({ where: { tiebreakerDecidedById: secondaryId } }),
            prisma.tournamentWaitlist.count({ where: { playerId: secondaryId } }),
            prisma.tournamentInvite.count({ where: { playerId: secondaryId } }),
            prisma.tournamentInvite.count({ where: { invitedBy: secondaryId } }),
            prisma.inviteRequest.count({ where: { playerId: secondaryId } }),
            prisma.inviteRequest.count({ where: { reviewedBy: secondaryId } }),
        ]);

        const preview: MergePreview = {
            lineupEntriesP1,
            lineupEntriesP2,
            stopTeamPlayers,
            teamPlayers,
            tournamentRegistrations,
            teamsAsCaptain,
            captainInvites,
            tournamentAdmins,
            tournamentCaptains,
            tournamentEventManagers,
            stopsManaged,
            clubDirectors,
            matchTiebreakerDecisions,
            waitlistEntries,
            invitesReceived,
            invitesSent,
            inviteRequestsSent,
            inviteRequestsReviewed,
        };

        const totalItems = Object.values(preview).reduce((sum, count) => sum + count, 0);

        // Determine Clerk merge scenario
        let clerkMergeInfo = '';
        if (primaryPlayer.clerkUserId && secondaryPlayer.clerkUserId) {
            clerkMergeInfo = `Both players have Clerk accounts. ${secondaryPlayer.email || 'Secondary email'} will be added to the kept account, and the orphaned Clerk user will be deleted.`;
        } else if (!primaryPlayer.clerkUserId && secondaryPlayer.clerkUserId) {
            clerkMergeInfo = 'Only secondary player has a Clerk account. It will be deleted (unusual scenario).';
        } else if (primaryPlayer.clerkUserId && !secondaryPlayer.clerkUserId) {
            clerkMergeInfo = 'Only the primary player has a Clerk account. No Clerk changes needed.';
        } else {
            clerkMergeInfo = 'Neither player has a Clerk account. No Clerk changes needed.';
        }

        return NextResponse.json({
            primaryPlayer,
            secondaryPlayer,
            preview,
            totalItems,
            clerkMergeInfo,
        });
    } catch (error) {
        console.error('Error previewing merge:', error);
        return NextResponse.json(
            { error: 'Failed to preview merge' },
            { status: 500 }
        );
    }
}

/**
 * POST /api/app-admin/players/merge
 * Execute the merge of two players
 * Body: { primaryId: string, secondaryId: string }
 */
export async function POST(req: NextRequest) {
    try {
        const { userId } = await auth();
        if (!userId) {
            return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
        }

        // Verify user is app admin
        const admin = await prisma.player.findUnique({
            where: { clerkUserId: userId },
            select: { id: true, isAppAdmin: true },
        });

        if (!admin?.isAppAdmin) {
            return NextResponse.json({ error: 'App admin access required' }, { status: 403 });
        }

        const body = await req.json();
        const { primaryId, secondaryId } = body;

        if (!primaryId || !secondaryId) {
            return NextResponse.json({ error: 'Both primaryId and secondaryId are required' }, { status: 400 });
        }

        if (primaryId === secondaryId) {
            return NextResponse.json({ error: 'Cannot merge a player with themselves' }, { status: 400 });
        }

        // Fetch both players
        const [primaryPlayer, secondaryPlayer] = await Promise.all([
            prisma.player.findUnique({
                where: { id: primaryId },
                select: {
                    id: true,
                    firstName: true,
                    lastName: true,
                    name: true,
                    email: true,
                    clerkUserId: true,
                },
            }),
            prisma.player.findUnique({
                where: { id: secondaryId },
                select: {
                    id: true,
                    firstName: true,
                    lastName: true,
                    name: true,
                    email: true,
                    clerkUserId: true,
                },
            }),
        ]);

        if (!primaryPlayer) {
            return NextResponse.json({ error: 'Primary player not found' }, { status: 404 });
        }
        if (!secondaryPlayer) {
            return NextResponse.json({ error: 'Secondary player not found' }, { status: 404 });
        }

        // Store secondary player info before deletion
        const secondaryPlayerName = secondaryPlayer.name ||
            `${secondaryPlayer.firstName || ''} ${secondaryPlayer.lastName || ''}`.trim() ||
            'Unknown';

        // Track what we transfer
        const transferred: Record<string, number> = {};

        // Execute the merge in a transaction
        await prisma.$transaction(async (tx) => {
            // 1. Transfer lineup entries (player1)
            const lineupP1 = await tx.lineupEntry.updateMany({
                where: { player1Id: secondaryId },
                data: { player1Id: primaryId },
            });
            transferred.lineupEntriesP1 = lineupP1.count;

            // 2. Transfer lineup entries (player2)
            const lineupP2 = await tx.lineupEntry.updateMany({
                where: { player2Id: secondaryId },
                data: { player2Id: primaryId },
            });
            transferred.lineupEntriesP2 = lineupP2.count;

            // 3. Transfer stop roster entries (handle duplicates)
            const secondaryRosters = await tx.stopTeamPlayer.findMany({
                where: { playerId: secondaryId },
                select: { stopId: true, teamId: true },
            });
            const primaryRosters = await tx.stopTeamPlayer.findMany({
                where: { playerId: primaryId },
                select: { stopId: true, teamId: true },
            });
            const primaryRosterKeys = new Set(primaryRosters.map(r => `${r.stopId}-${r.teamId}`));

            let rosterTransferred = 0;
            for (const roster of secondaryRosters) {
                const key = `${roster.stopId}-${roster.teamId}`;
                if (!primaryRosterKeys.has(key)) {
                    await tx.stopTeamPlayer.updateMany({
                        where: { stopId: roster.stopId, teamId: roster.teamId, playerId: secondaryId },
                        data: { playerId: primaryId },
                    });
                    rosterTransferred++;
                } else {
                    // Delete duplicate
                    await tx.stopTeamPlayer.deleteMany({
                        where: { stopId: roster.stopId, teamId: roster.teamId, playerId: secondaryId },
                    });
                }
            }
            transferred.stopTeamPlayers = rosterTransferred;

            // 4. Transfer team memberships (handle duplicates by tournament)
            const secondaryTeamLinks = await tx.teamPlayer.findMany({
                where: { playerId: secondaryId },
                select: { teamId: true, tournamentId: true },
            });
            const primaryTeamLinks = await tx.teamPlayer.findMany({
                where: { playerId: primaryId },
                select: { tournamentId: true },
            });
            const primaryTournamentIds = new Set(primaryTeamLinks.map(t => t.tournamentId));

            let teamLinksTransferred = 0;
            for (const link of secondaryTeamLinks) {
                if (!primaryTournamentIds.has(link.tournamentId)) {
                    await tx.teamPlayer.updateMany({
                        where: { teamId: link.teamId, playerId: secondaryId },
                        data: { playerId: primaryId },
                    });
                    teamLinksTransferred++;
                } else {
                    await tx.teamPlayer.deleteMany({
                        where: { teamId: link.teamId, playerId: secondaryId },
                    });
                }
            }
            transferred.teamPlayers = teamLinksTransferred;

            // 5. Transfer tournament registrations (handle duplicates)
            const secondaryRegs = await tx.tournamentRegistration.findMany({
                where: { playerId: secondaryId },
                select: { id: true, tournamentId: true },
            });
            const primaryRegs = await tx.tournamentRegistration.findMany({
                where: { playerId: primaryId },
                select: { tournamentId: true },
            });
            const primaryRegTournaments = new Set(primaryRegs.map(r => r.tournamentId));

            let regsTransferred = 0;
            for (const reg of secondaryRegs) {
                if (!primaryRegTournaments.has(reg.tournamentId)) {
                    await tx.tournamentRegistration.update({
                        where: { id: reg.id },
                        data: { playerId: primaryId },
                    });
                    regsTransferred++;
                } else {
                    await tx.tournamentRegistration.delete({ where: { id: reg.id } });
                }
            }
            transferred.tournamentRegistrations = regsTransferred;

            // 6. Transfer teams as captain
            const captainTeams = await tx.team.updateMany({
                where: { captainId: secondaryId },
                data: { captainId: primaryId },
            });
            transferred.teamsAsCaptain = captainTeams.count;

            // 7. Transfer captain invites
            const invites = await tx.captainInvite.updateMany({
                where: { captainId: secondaryId },
                data: { captainId: primaryId },
            });
            transferred.captainInvites = invites.count;

            // 8. Transfer tournament admin roles (handle duplicates)
            const secondaryAdmins = await tx.tournamentAdmin.findMany({
                where: { playerId: secondaryId },
                select: { tournamentId: true },
            });
            const primaryAdmins = await tx.tournamentAdmin.findMany({
                where: { playerId: primaryId },
                select: { tournamentId: true },
            });
            const primaryAdminTournaments = new Set(primaryAdmins.map(a => a.tournamentId));

            let adminsTransferred = 0;
            for (const adminRole of secondaryAdmins) {
                if (!primaryAdminTournaments.has(adminRole.tournamentId)) {
                    await tx.tournamentAdmin.updateMany({
                        where: { tournamentId: adminRole.tournamentId, playerId: secondaryId },
                        data: { playerId: primaryId },
                    });
                    adminsTransferred++;
                } else {
                    await tx.tournamentAdmin.deleteMany({
                        where: { tournamentId: adminRole.tournamentId, playerId: secondaryId },
                    });
                }
            }
            transferred.tournamentAdmins = adminsTransferred;

            // 9. Transfer tournament captain roles (handle duplicates)
            const secondaryCaptains = await tx.tournamentCaptain.findMany({
                where: { playerId: secondaryId },
                select: { tournamentId: true, clubId: true },
            });
            const primaryCaptains = await tx.tournamentCaptain.findMany({
                where: { playerId: primaryId },
                select: { tournamentId: true },
            });
            const primaryCaptainTournaments = new Set(primaryCaptains.map(c => c.tournamentId));

            let captainsTransferred = 0;
            for (const captain of secondaryCaptains) {
                if (!primaryCaptainTournaments.has(captain.tournamentId)) {
                    await tx.tournamentCaptain.updateMany({
                        where: { tournamentId: captain.tournamentId, clubId: captain.clubId, playerId: secondaryId },
                        data: { playerId: primaryId },
                    });
                    captainsTransferred++;
                } else {
                    await tx.tournamentCaptain.deleteMany({
                        where: { tournamentId: captain.tournamentId, clubId: captain.clubId, playerId: secondaryId },
                    });
                }
            }
            transferred.tournamentCaptains = captainsTransferred;

            // 10. Transfer tournament event manager roles
            const secondaryEventManagers = await tx.tournamentEventManager.findMany({
                where: { playerId: secondaryId },
                select: { tournamentId: true },
            });
            const primaryEventManagers = await tx.tournamentEventManager.findMany({
                where: { playerId: primaryId },
                select: { tournamentId: true },
            });
            const primaryEventManagerTournaments = new Set(primaryEventManagers.map(e => e.tournamentId));

            let eventManagersTransferred = 0;
            for (const em of secondaryEventManagers) {
                if (!primaryEventManagerTournaments.has(em.tournamentId)) {
                    await tx.tournamentEventManager.updateMany({
                        where: { tournamentId: em.tournamentId, playerId: secondaryId },
                        data: { playerId: primaryId },
                    });
                    eventManagersTransferred++;
                } else {
                    await tx.tournamentEventManager.deleteMany({
                        where: { tournamentId: em.tournamentId, playerId: secondaryId },
                    });
                }
            }
            transferred.tournamentEventManagers = eventManagersTransferred;

            // 11. Transfer stops managed
            const stops = await tx.stop.updateMany({
                where: { eventManagerId: secondaryId },
                data: { eventManagerId: primaryId },
            });
            transferred.stopsManaged = stops.count;

            // 12. Transfer club director roles (handle duplicates)
            const secondaryDirectors = await tx.clubDirector.findMany({
                where: { playerId: secondaryId },
                select: { clubId: true },
            });
            const primaryDirectors = await tx.clubDirector.findMany({
                where: { playerId: primaryId },
                select: { clubId: true },
            });
            const primaryDirectorClubs = new Set(primaryDirectors.map(d => d.clubId));

            let directorsTransferred = 0;
            for (const director of secondaryDirectors) {
                if (!primaryDirectorClubs.has(director.clubId)) {
                    await tx.clubDirector.updateMany({
                        where: { clubId: director.clubId, playerId: secondaryId },
                        data: { playerId: primaryId },
                    });
                    directorsTransferred++;
                } else {
                    await tx.clubDirector.deleteMany({
                        where: { clubId: director.clubId, playerId: secondaryId },
                    });
                }
            }
            transferred.clubDirectors = directorsTransferred;

            // 13. Transfer match tiebreaker decisions
            const matches = await tx.match.updateMany({
                where: { tiebreakerDecidedById: secondaryId },
                data: { tiebreakerDecidedById: primaryId },
            });
            transferred.matchTiebreakerDecisions = matches.count;

            // 14. Transfer waitlist entries (handle duplicates)
            const secondaryWaitlist = await tx.tournamentWaitlist.findMany({
                where: { playerId: secondaryId },
                select: { id: true, tournamentId: true },
            });
            const primaryWaitlist = await tx.tournamentWaitlist.findMany({
                where: { playerId: primaryId },
                select: { tournamentId: true },
            });
            const primaryWaitlistTournaments = new Set(primaryWaitlist.map(w => w.tournamentId));

            let waitlistTransferred = 0;
            for (const entry of secondaryWaitlist) {
                if (!primaryWaitlistTournaments.has(entry.tournamentId)) {
                    await tx.tournamentWaitlist.update({
                        where: { id: entry.id },
                        data: { playerId: primaryId },
                    });
                    waitlistTransferred++;
                } else {
                    await tx.tournamentWaitlist.delete({ where: { id: entry.id } });
                }
            }
            transferred.waitlistEntries = waitlistTransferred;

            // 15. Transfer tournament invites received
            const invitesReceived = await tx.tournamentInvite.updateMany({
                where: { playerId: secondaryId },
                data: { playerId: primaryId },
            });
            transferred.invitesReceived = invitesReceived.count;

            // 16. Transfer tournament invites sent
            const invitesSent = await tx.tournamentInvite.updateMany({
                where: { invitedBy: secondaryId },
                data: { invitedBy: primaryId },
            });
            transferred.invitesSent = invitesSent.count;

            // 17. Transfer invite requests sent
            const requestsSent = await tx.inviteRequest.updateMany({
                where: { playerId: secondaryId },
                data: { playerId: primaryId },
            });
            transferred.inviteRequestsSent = requestsSent.count;

            // 18. Transfer invite requests reviewed
            const requestsReviewed = await tx.inviteRequest.updateMany({
                where: { reviewedBy: secondaryId },
                data: { reviewedBy: primaryId },
            });
            transferred.inviteRequestsReviewed = requestsReviewed.count;

            // 19. Transfer ActAs audit logs (both admin and target)
            await tx.actAsAuditLog.updateMany({
                where: { adminPlayerId: secondaryId },
                data: { adminPlayerId: primaryId },
            });
            await tx.actAsAuditLog.updateMany({
                where: { targetPlayerId: secondaryId },
                data: { targetPlayerId: primaryId },
            });

            // 20. Delete the secondary player
            await tx.player.delete({ where: { id: secondaryId } });
        });

        // Handle Clerk merge (outside transaction since it's external)
        let clerkResult: ClerkMergeResult = { status: 'SKIPPED' };
        try {
            clerkResult = await mergeClerkAccounts(
                primaryPlayer.clerkUserId,
                secondaryPlayer.clerkUserId,
                secondaryPlayer.email
            );
        } catch (error) {
            console.error('Clerk merge failed:', error);
            clerkResult = {
                status: 'MANUAL_REQUIRED',
                notes: `Clerk operation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
            };
        }

        // Create merge log entry
        await prisma.playerMergeLog.create({
            data: {
                primaryPlayerId: primaryId,
                secondaryPlayerId: secondaryId,
                secondaryPlayerName,
                secondaryPlayerEmail: secondaryPlayer.email,
                secondaryClerkUserId: secondaryPlayer.clerkUserId,
                mergedBy: admin.id,
                transferredData: transferred,
                clerkMergeStatus: clerkResult.status,
                clerkMergeNotes: clerkResult.notes,
            },
        });

        return NextResponse.json({
            success: true,
            message: `Successfully merged ${secondaryPlayerName} into ${primaryPlayer.name || primaryPlayer.firstName}`,
            transferred,
            clerkResult,
        });
    } catch (error) {
        console.error('Error executing merge:', error);
        return NextResponse.json(
            { error: 'Failed to execute merge', details: error instanceof Error ? error.message : 'Unknown error' },
            { status: 500 }
        );
    }
}
