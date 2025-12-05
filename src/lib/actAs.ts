import { auth } from '@clerk/nextjs/server';
import { prisma } from './prisma';

/**
 * Server-side Act As implementation
 * Allows app admins to impersonate other users for viewing data
 */

export type ActAsResult = {
  realUserId: string;
  realPlayerId: string;
  isActingAs: boolean;
  targetPlayerId: string;
  isAppAdmin: boolean;
};

/**
 * Get the effective player ID, supporting "Act As" functionality
 *
 * @param actAsPlayerId - Optional player ID to impersonate (from request header)
 * @param request - Request object for audit logging (optional but recommended)
 * @returns ActAsResult with player IDs and admin status
 */
export async function getEffectivePlayer(
  actAsPlayerId: string | null,
  request?: Request
): Promise<ActAsResult> {
  const { userId } = await auth();

  if (!userId) {
    throw new Error('Not authenticated');
  }

  // Get the real authenticated user's player record
  const realPlayer = await prisma.player.findUnique({
    where: { clerkUserId: userId },
    select: { id: true, isAppAdmin: true }
  });

  if (!realPlayer) {
    throw new Error('Player not found');
  }

  // If no act-as requested, return the real user
  if (!actAsPlayerId) {
    return {
      realUserId: userId,
      realPlayerId: realPlayer.id,
      isActingAs: false,
      targetPlayerId: realPlayer.id,
      isAppAdmin: realPlayer.isAppAdmin
    };
  }

  // Only app admins can use Act As
  if (!realPlayer.isAppAdmin) {
    throw new Error('Only app admins can use Act As functionality');
  }

  // Validate the target player exists
  const targetPlayer = await prisma.player.findUnique({
    where: { id: actAsPlayerId },
    select: { id: true }
  });

  if (!targetPlayer) {
    throw new Error('Target player not found');
  }

  // AUDIT LOGGING
  try {
    // If request context is provided, log the action
    if (request && actAsPlayerId && actAsPlayerId !== realPlayer.id) {
      const ipAddress = request.headers.get('x-forwarded-for') ||
        request.headers.get('x-real-ip') || 'unknown';
      const userAgent = request.headers.get('user-agent') || 'unknown';
      const path = new URL(request.url).pathname;

      // Check if we logged this session recently (e.g. within last 5 minutes) to avoid spamming logs on every fetch
      const recentLog = await prisma.actAsAuditLog.findFirst({
        where: {
          adminPlayerId: realPlayer.id,
          targetPlayerId: actAsPlayerId,
          createdAt: { gt: new Date(Date.now() - 5 * 60 * 1000) }
        }
      });

      if (!recentLog) {
        await prisma.actAsAuditLog.create({
          data: {
            adminPlayerId: realPlayer.id,
            targetPlayerId: actAsPlayerId,
            action: 'IMPERSONATE',
            endpoint: path,
            ipAddress,
            userAgent,
            expiresAt: new Date(Date.now() + 4 * 60 * 60 * 1000) // 4 hours
          }
        });
      }
    }
  } catch (error) {
    console.error('Failed to log ActAs audit:', error);
    // Don't block the functionality if logging fails, but maybe alert
  }

  return {
    realUserId: userId,
    realPlayerId: realPlayer.id,
    isActingAs: true,
    targetPlayerId: actAsPlayerId,
    isAppAdmin: realPlayer.isAppAdmin
  };
}

/**
 * Extract act-as player ID from request headers
 */
export function getActAsHeaderFromRequest(request: Request): string | null {
  const actAsHeader = request.headers.get('x-act-as-player-id');
  return actAsHeader || null;
}
