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
 * @returns ActAsResult with player IDs and admin status
 */
export async function getEffectivePlayer(actAsPlayerId?: string | null): Promise<ActAsResult> {
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
