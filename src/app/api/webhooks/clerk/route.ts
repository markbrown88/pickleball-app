import { NextRequest, NextResponse } from 'next/server';
import { Webhook } from 'svix';
import { headers } from 'next/headers';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

type ClerkWebhookEvent = {
  type: string;
  data: {
    id: string;
    email_addresses: Array<{
      email_address: string;
      id: string;
    }>;
    primary_email_address_id: string;
    first_name: string | null;
    last_name: string | null;
    image_url: string;
  };
};

/**
 * POST /api/webhooks/clerk
 *
 * Handles Clerk webhook events, specifically user.created
 *
 * When a new user signs up with Clerk:
 * 1. Check if a Player record exists with that email (but no clerkUserId)
 * 2. If yes, link the Clerk account to the existing Player record
 * 3. If no, this will be handled by the auth middleware creating a new Player
 */
export async function POST(req: NextRequest) {
  try {
    // Get the webhook secret from environment
    const webhookSecret = process.env.CLERK_WEBHOOK_SECRET;

    if (!webhookSecret) {
      console.error('CLERK_WEBHOOK_SECRET is not set');
      return NextResponse.json(
        { error: 'Webhook secret not configured' },
        { status: 500 }
      );
    }

    // Get headers
    const headerPayload = await headers();
    const svix_id = headerPayload.get('svix-id');
    const svix_timestamp = headerPayload.get('svix-timestamp');
    const svix_signature = headerPayload.get('svix-signature');

    // If there are no headers, error out
    if (!svix_id || !svix_timestamp || !svix_signature) {
      return NextResponse.json(
        { error: 'Missing svix headers' },
        { status: 400 }
      );
    }

    // Get the body
    const payload = await req.text();

    // Create a new Svix instance with your webhook secret
    const wh = new Webhook(webhookSecret);

    let evt: ClerkWebhookEvent;

    // Verify the webhook signature
    try {
      evt = wh.verify(payload, {
        'svix-id': svix_id,
        'svix-timestamp': svix_timestamp,
        'svix-signature': svix_signature,
      }) as ClerkWebhookEvent;
    } catch (err) {
      console.error('Error verifying webhook:', err);
      return NextResponse.json(
        { error: 'Invalid signature' },
        { status: 400 }
      );
    }

    // Handle the webhook
    const eventType = evt.type;

    if (eventType === 'user.created') {
      const { id: clerkUserId, email_addresses, primary_email_address_id, first_name, last_name, image_url } = evt.data;

      // Get the primary email
      const primaryEmail = email_addresses.find(
        (email) => email.id === primary_email_address_id
      );

      if (!primaryEmail) {
        console.error('No primary email found for user', clerkUserId);
        return NextResponse.json(
          { error: 'No primary email found' },
          { status: 400 }
        );
      }

      const email = primaryEmail.email_address.toLowerCase();


      // Check if a Player record exists with this email (but no clerkUserId)
      const existingPlayer = await prisma.player.findFirst({
        where: {
          email: email,
          clerkUserId: null,
        },
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          name: true,
        },
      });

      if (existingPlayer) {

        // Link the Clerk account to the existing Player record
        await prisma.player.update({
          where: { id: existingPlayer.id },
          data: {
            clerkUserId: clerkUserId,
            // Update name fields if they're empty and Clerk provides them
            firstName: existingPlayer.firstName || first_name || undefined,
            lastName: existingPlayer.lastName || last_name || undefined,
            // Update the name field if it's empty
            name: existingPlayer.name || (first_name && last_name ? `${first_name} ${last_name}` : undefined),
            image: image_url,
          },
        });


        return NextResponse.json({
          success: true,
          action: 'linked',
          playerId: existingPlayer.id,
          clerkUserId,
        });
      } else {

        // Find a default club to assign to the new player
        // Try to find the first club alphabetically, or create a default one if none exists
        let defaultClub = await prisma.club.findFirst({
          orderBy: { name: 'asc' },
          select: { id: true },
        });

        // If no clubs exist, we need to handle this - but this should be rare
        // For now, we'll log an error and return - the player can be created later via profile setup
        if (!defaultClub) {
          console.error('No clubs found in database. Cannot create Player without a club.');
          return NextResponse.json({
            success: false,
            action: 'failed',
            error: 'No clubs available. Player must be created manually or after a club is added.',
            message: 'Please contact support or complete your profile setup.',
          }, { status: 500 });
        }

        // Create a new Player record for the new Clerk user
        // Use email and any available name information from Clerk
        const newPlayer = await prisma.player.create({
          data: {
            clerkUserId: clerkUserId,
            email: email,
            firstName: first_name || null,
            lastName: last_name || null,
            name: first_name && last_name ? `${first_name} ${last_name}` : first_name || last_name || null,
            gender: 'MALE', // Default, can be updated later
            country: 'Canada', // Default for this application
            clubId: defaultClub.id, // Required field - assign to first available club
            image: image_url,
          },
        });


        return NextResponse.json({
          success: true,
          action: 'created',
          playerId: newPlayer.id,
          clerkUserId,
        });
      }
    }

    // For other event types, just acknowledge
    return NextResponse.json({ success: true, eventType });
  } catch (error: any) {
    console.error('Error processing Clerk webhook:', error);
    console.error('Error details:', {
      message: error?.message,
      stack: error?.stack,
      code: error?.code,
    });
    return NextResponse.json(
      {
        error: 'Internal server error',
        details: process.env.NODE_ENV === 'development' ? error?.message : undefined,
      },
      { status: 500 }
    );
  }
}
