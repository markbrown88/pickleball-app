import { createClerkClient, ClerkClient } from '@clerk/backend';

// Lazy initialization of Clerk client to work in serverless environments
let _clerkClient: ClerkClient | null = null;

function getClerkClient(): ClerkClient {
  if (!_clerkClient) {
    const secretKey = process.env.CLERK_SECRET_KEY;
    if (!secretKey) {
      throw new Error('CLERK_SECRET_KEY environment variable is not set');
    }
    _clerkClient = createClerkClient({ secretKey });
  }
  return _clerkClient;
}

export type ClerkMergeResult = {
  status: 'SUCCESS' | 'PARTIAL' | 'MANUAL_REQUIRED' | 'SKIPPED';
  notes?: string;
};

/**
 * Merges Clerk accounts during player merge operation.
 * Handles all scenarios:
 * - Neither has Clerk account: skip
 * - Only primary has Clerk: skip
 * - Only secondary has Clerk: delete orphaned user
 * - Both have Clerk: add email to primary, delete secondary
 * 
 * @param keepClerkId - Clerk user ID of the player being kept (primary)
 * @param deleteClerkId - Clerk user ID of the player being deleted (secondary)
 * @param emailToTransfer - Email from secondary player to add to primary
 */
export async function mergeClerkAccounts(
  keepClerkId: string | null,
  deleteClerkId: string | null,
  emailToTransfer: string | null
): Promise<ClerkMergeResult> {
  // Case 1: Neither has Clerk account
  if (!keepClerkId && !deleteClerkId) {
    return { status: 'SKIPPED', notes: 'Neither player has a Clerk account' };
  }

  // Case 2: Only primary has Clerk - nothing to do
  if (keepClerkId && !deleteClerkId) {
    return { status: 'SKIPPED', notes: 'Secondary player had no Clerk account' };
  }

  // Case 3: Only secondary has Clerk - this is unusual, just delete it
  if (!keepClerkId && deleteClerkId) {
    try {
      await getClerkClient().users.deleteUser(deleteClerkId);
      return { status: 'SUCCESS', notes: 'Deleted orphaned Clerk user (primary had no Clerk account)' };
    } catch (error) {
      console.error('Failed to delete Clerk user:', error);
      return {
        status: 'MANUAL_REQUIRED',
        notes: `Failed to delete Clerk user ${deleteClerkId}: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  // Case 4: Both have Clerk accounts - transfer email and delete
  let emailAdded = false;
  let userDeleted = false;
  const notes: string[] = [];

  // Add email to kept user (if we have an email to transfer)
  if (emailToTransfer) {
    try {
      await getClerkClient().emailAddresses.createEmailAddress({
        userId: keepClerkId!,
        emailAddress: emailToTransfer,
      });
      emailAdded = true;
      notes.push(`Added email ${emailToTransfer} to kept user`);
    } catch (error) {
      // Email might already exist or be invalid
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      notes.push(`Failed to add email: ${errorMsg}`);
      console.error('Failed to add email to Clerk user:', error);
    }
  } else {
    notes.push('No email to transfer');
  }

  // Delete orphaned user
  try {
    await getClerkClient().users.deleteUser(deleteClerkId!);
    userDeleted = true;
    notes.push(`Deleted Clerk user ${deleteClerkId}`);
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
    notes.push(`Failed to delete user: ${errorMsg}`);
    console.error('Failed to delete Clerk user:', error);
  }

  // Determine overall status
  if (userDeleted && (emailAdded || !emailToTransfer)) {
    return { status: 'SUCCESS', notes: notes.join('; ') };
  } else if (emailAdded || userDeleted) {
    return { status: 'PARTIAL', notes: notes.join('; ') };
  } else {
    return { status: 'MANUAL_REQUIRED', notes: notes.join('; ') };
  }
}

/**
 * Get Clerk user info by ID
 */
export async function getClerkUser(clerkUserId: string) {
  try {
    return await getClerkClient().users.getUser(clerkUserId);
  } catch (error) {
    console.error('Failed to get Clerk user:', error);
    return null;
  }
}
