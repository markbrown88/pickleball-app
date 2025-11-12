import { NextRequest, NextResponse } from 'next/server';
import { sendEmail } from '@/server/email';
import { sendRegistrationConfirmationEmail } from '@/server/email';

/**
 * POST /api/test/email
 * Test email sending functionality
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { to, type = 'simple' } = body;

    if (!to) {
      return NextResponse.json(
        { error: 'Email address (to) is required' },
        { status: 400 }
      );
    }

    const hasResendKey = !!process.env.RESEND_API_KEY;
    const resendKeyStatus = hasResendKey 
      ? 'configured' 
      : 'NOT CONFIGURED (emails will only be logged to console)';

    if (type === 'registration') {
      // Test registration confirmation email
      try {
        await sendRegistrationConfirmationEmail({
          to,
          playerName: 'Test Player',
          tournamentName: 'Test Tournament',
          tournamentId: 'test-tournament-id',
          startDate: new Date(),
          endDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days from now
          location: 'Test Location, Test City',
          isPaid: true,
          amountPaid: 5000, // $50.00
          registrationDate: new Date(),
        });

        return NextResponse.json({
          success: true,
          message: 'Registration confirmation email sent',
          resendKeyStatus,
          note: hasResendKey 
            ? 'Email should arrive shortly. Check your inbox (and spam folder).'
            : 'RESEND_API_KEY not set - email was only logged to console. Check server logs.',
        });
      } catch (error) {
        console.error('Error sending registration email:', error);
        return NextResponse.json(
          {
            success: false,
            error: 'Failed to send registration email',
            details: error instanceof Error ? error.message : 'Unknown error',
            resendKeyStatus,
          },
          { status: 500 }
        );
      }
    } else {
      // Simple test email
      try {
        await sendEmail({
          to,
          subject: 'Test Email from Pickleball App',
          html: `
            <html>
              <body style="font-family: Arial, sans-serif; padding: 20px;">
                <h1>Test Email</h1>
                <p>This is a test email from your Pickleball Tournament App.</p>
                <p>If you received this email, the email service is working correctly!</p>
                <hr>
                <p style="color: #666; font-size: 12px;">
                  Sent at: ${new Date().toISOString()}<br>
                  Resend API Key: ${hasResendKey ? 'Configured ✓' : 'NOT CONFIGURED ✗'}
                </p>
              </body>
            </html>
          `,
        });

        return NextResponse.json({
          success: true,
          message: 'Test email sent',
          resendKeyStatus,
          note: hasResendKey 
            ? 'Email should arrive shortly. Check your inbox (and spam folder).'
            : 'RESEND_API_KEY not set - email was only logged to console. Check server logs.',
        });
      } catch (error) {
        console.error('Error sending test email:', error);
        return NextResponse.json(
          {
            success: false,
            error: 'Failed to send test email',
            details: error instanceof Error ? error.message : 'Unknown error',
            resendKeyStatus,
          },
          { status: 500 }
        );
      }
    }
  } catch (error) {
    console.error('Error in test email endpoint:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to process request',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/test/email
 * Check email service configuration
 */
export async function GET() {
  const hasResendKey = !!process.env.RESEND_API_KEY;
  
  return NextResponse.json({
    emailServiceConfigured: hasResendKey,
    resendKeyStatus: hasResendKey 
      ? 'configured' 
      : 'NOT CONFIGURED',
    note: hasResendKey
      ? 'Emails will be sent via Resend API'
      : 'Emails will only be logged to console. Set RESEND_API_KEY in your .env.local file to enable email sending.',
    environment: process.env.NODE_ENV,
    fromAddress: process.env.RESEND_FROM_ADDRESS || 'Tournaments <no-reply@your-domain>',
  });
}

