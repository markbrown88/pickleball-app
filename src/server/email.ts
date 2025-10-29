import { Resend } from 'resend';

interface SendEmailOptions {
  to: string;
  subject: string;
  html: string;
  from?: string;
}

export async function sendEmail(options: SendEmailOptions) {
  if (!process.env.RESEND_API_KEY) {
    console.log('[DEV: email]', { to: options.to, subject: options.subject });
    return;
  }

  const resend = new Resend(process.env.RESEND_API_KEY);
  await resend.emails.send({
    from: options.from || 'Tournaments <no-reply@your-domain>',
    to: options.to,
    subject: options.subject,
    html: options.html
  });
}

export async function sendCaptainInviteEmail(to: string, link: string) {
  await sendEmail({
    to,
    subject: 'Your captain link',
    html: `<p>Hi Captain,</p><p>Manage your team here: <a href="${link}">${link}</a></p>`
  });
}

interface TournamentInviteEmailParams {
  to: string;
  recipientName: string;
  tournamentName: string;
  invitedByName: string;
  expiresAt: Date;
  registrationLink: string;
  signupLink?: string; // For new users who need to create an account
  notes?: string;
}

export async function sendTournamentInviteEmail(params: TournamentInviteEmailParams) {
  const {
    to,
    recipientName,
    tournamentName,
    invitedByName,
    expiresAt,
    registrationLink,
    signupLink,
    notes
  } = params;

  const expiryDate = expiresAt.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  const actionButton = signupLink
    ? `<a href="${signupLink}" style="display: inline-block; background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 600; margin: 20px 0;">Create Account & Register</a>`
    : `<a href="${registrationLink}" style="display: inline-block; background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 600; margin: 20px 0;">View Tournament & Register</a>`;

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Tournament Invitation</title>
      </head>
      <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f3f4f6;">
        <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f3f4f6; padding: 40px 20px;">
          <tr>
            <td align="center">
              <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 600px; background-color: white; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">

                <!-- Header -->
                <tr>
                  <td style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 40px 30px; text-align: center; border-radius: 8px 8px 0 0;">
                    <h1 style="margin: 0; color: white; font-size: 28px; font-weight: 700;">You're Invited!</h1>
                    <p style="margin: 10px 0 0 0; color: rgba(255,255,255,0.9); font-size: 16px;">Tournament Registration</p>
                  </td>
                </tr>

                <!-- Body -->
                <tr>
                  <td style="padding: 40px 30px;">
                    <p style="margin: 0 0 20px 0; font-size: 16px; line-height: 1.6; color: #374151;">
                      Hi <strong>${recipientName}</strong>,
                    </p>

                    <p style="margin: 0 0 20px 0; font-size: 16px; line-height: 1.6; color: #374151;">
                      <strong>${invitedByName}</strong> has invited you to register for the upcoming tournament:
                    </p>

                    <div style="background-color: #f9fafb; border-left: 4px solid #2563eb; padding: 20px; margin: 0 0 30px 0; border-radius: 4px;">
                      <h2 style="margin: 0 0 10px 0; font-size: 22px; color: #111827;">${tournamentName}</h2>
                      <p style="margin: 0; font-size: 14px; color: #6b7280;">
                        <strong>Invitation expires:</strong> ${expiryDate}
                      </p>
                    </div>

                    ${notes ? `
                      <div style="background-color: #fffbeb; border-left: 4px solid #f59e0b; padding: 15px; margin: 0 0 30px 0; border-radius: 4px;">
                        <p style="margin: 0; font-size: 14px; color: #92400e; font-weight: 600;">Note from ${invitedByName}:</p>
                        <p style="margin: 10px 0 0 0; font-size: 14px; color: #78350f; line-height: 1.5;">${notes}</p>
                      </div>
                    ` : ''}

                    <p style="margin: 0 0 10px 0; font-size: 16px; line-height: 1.6; color: #374151;">
                      ${signupLink
                        ? "Click the button below to create your account and register for the tournament:"
                        : "Click the button below to view tournament details and complete your registration:"}
                    </p>

                    <div style="text-align: center; margin: 30px 0;">
                      ${actionButton}
                    </div>

                    <p style="margin: 20px 0 0 0; font-size: 14px; line-height: 1.6; color: #6b7280;">
                      If you have any questions, please contact <strong>${invitedByName}</strong> or the tournament organizers.
                    </p>
                  </td>
                </tr>

                <!-- Footer -->
                <tr>
                  <td style="background-color: #f9fafb; padding: 30px; text-align: center; border-radius: 0 0 8px 8px; border-top: 1px solid #e5e7eb;">
                    <p style="margin: 0 0 10px 0; font-size: 12px; color: #9ca3af;">
                      This invitation was sent to ${to}
                    </p>
                    <p style="margin: 0; font-size: 12px; color: #9ca3af;">
                      Please do not reply to this email. This mailbox is not monitored.
                    </p>
                  </td>
                </tr>

              </table>
            </td>
          </tr>
        </table>
      </body>
    </html>
  `;

  await sendEmail({
    to,
    subject: `You're invited to ${tournamentName}`,
    html
  });
}

interface RegistrationConfirmationEmailParams {
  to: string;
  playerName: string;
  tournamentName: string;
  tournamentId: string;
  startDate?: Date | null;
  endDate?: Date | null;
  location?: string | null;
  isPaid: boolean;
  amountPaid?: number | null; // in cents
  registrationDate: Date;
}

export async function sendRegistrationConfirmationEmail(params: RegistrationConfirmationEmailParams) {
  const {
    to,
    playerName,
    tournamentName,
    tournamentId,
    startDate,
    endDate,
    location,
    isPaid,
    amountPaid,
    registrationDate
  } = params;

  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3010';
  const tournamentLink = `${baseUrl}/tournament/${tournamentId}`;

  const formatDate = (date: Date | null | undefined) => {
    if (!date) return 'TBD';
    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const dateRange = startDate && endDate
    ? `${formatDate(startDate)} - ${formatDate(endDate)}`
    : startDate
      ? formatDate(startDate)
      : 'Dates TBD';

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Registration Confirmed</title>
      </head>
      <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f3f4f6;">
        <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f3f4f6; padding: 40px 20px;">
          <tr>
            <td align="center">
              <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 600px; background-color: white; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">

                <!-- Header -->
                <tr>
                  <td style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); padding: 40px 30px; text-align: center; border-radius: 8px 8px 0 0;">
                    <div style="font-size: 48px; margin-bottom: 10px;">✓</div>
                    <h1 style="margin: 0; color: white; font-size: 28px; font-weight: 700;">Registration Confirmed!</h1>
                    <p style="margin: 10px 0 0 0; color: rgba(255,255,255,0.9); font-size: 16px;">You're all set</p>
                  </td>
                </tr>

                <!-- Body -->
                <tr>
                  <td style="padding: 40px 30px;">
                    <p style="margin: 0 0 20px 0; font-size: 16px; line-height: 1.6; color: #374151;">
                      Hi <strong>${playerName}</strong>,
                    </p>

                    <p style="margin: 0 0 20px 0; font-size: 16px; line-height: 1.6; color: #374151;">
                      Great news! You're officially registered for:
                    </p>

                    <div style="background-color: #ecfdf5; border-left: 4px solid: #10b981; padding: 20px; margin: 0 0 30px 0; border-radius: 4px;">
                      <h2 style="margin: 0 0 15px 0; font-size: 22px; color: #111827;">${tournamentName}</h2>

                      <div style="margin: 10px 0; font-size: 14px; color: #374151;">
                        <strong>📅 Dates:</strong> ${dateRange}
                      </div>

                      ${location ? `
                        <div style="margin: 10px 0; font-size: 14px; color: #374151;">
                          <strong>📍 Location:</strong> ${location}
                        </div>
                      ` : ''}

                      <div style="margin: 10px 0; font-size: 14px; color: #374151;">
                        <strong>✓ Registered:</strong> ${registrationDate.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                      </div>

                      ${isPaid && amountPaid ? `
                        <div style="margin: 10px 0; font-size: 14px; color: #374151;">
                          <strong>💳 Payment:</strong> $${(amountPaid / 100).toFixed(2)} paid
                        </div>
                      ` : ''}
                    </div>

                    <div style="background-color: #f9fafb; border-radius: 4px; padding: 20px; margin: 0 0 30px 0;">
                      <h3 style="margin: 0 0 15px 0; font-size: 18px; color: #111827;">What's Next?</h3>
                      <ul style="margin: 0; padding-left: 20px; font-size: 14px; line-height: 1.8; color: #374151;">
                        <li>Check your dashboard for tournament updates</li>
                        <li>The tournament schedule will be posted closer to the event date</li>
                        <li>Bring your paddle and a positive attitude!</li>
                        <li>You can view tournament details or cancel your registration from your dashboard</li>
                      </ul>
                    </div>

                    <div style="text-align: center; margin: 30px 0;">
                      <a href="${tournamentLink}" style="display: inline-block; background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 600;">View Tournament Details</a>
                    </div>

                    <p style="margin: 20px 0 0 0; font-size: 14px; line-height: 1.6; color: #6b7280;">
                      Need to make changes? You can cancel your registration from your dashboard anytime before the tournament starts.
                    </p>
                  </td>
                </tr>

                <!-- Footer -->
                <tr>
                  <td style="background-color: #f9fafb; padding: 30px; text-align: center; border-radius: 0 0 8px 8px; border-top: 1px solid #e5e7eb;">
                    <p style="margin: 0 0 10px 0; font-size: 12px; color: #9ca3af;">
                      See you on the court! 🏓
                    </p>
                    <p style="margin: 0; font-size: 12px; color: #9ca3af;">
                      This confirmation was sent to ${to}
                    </p>
                  </td>
                </tr>

              </table>
            </td>
          </tr>
        </table>
      </body>
    </html>
  `;

  await sendEmail({
    to,
    subject: `Registration Confirmed: ${tournamentName}`,
    html
  });
}

interface WithdrawalConfirmationEmailParams {
  to: string;
  playerName: string;
  tournamentName: string;
  tournamentId: string;
  wasRefunded: boolean;
  refundAmount?: number | null; // in cents
}

export async function sendWithdrawalConfirmationEmail(params: WithdrawalConfirmationEmailParams) {
  const { to, playerName, tournamentName, tournamentId, wasRefunded, refundAmount } = params;

  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3010';
  const tournamentLink = `${baseUrl}/tournament/${tournamentId}`;

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Registration Cancelled</title>
      </head>
      <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f3f4f6;">
        <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f3f4f6; padding: 40px 20px;">
          <tr>
            <td align="center">
              <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 600px; background-color: white; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">

                <!-- Header -->
                <tr>
                  <td style="background: linear-gradient(135deg, #6b7280 0%, #4b5563 100%); padding: 40px 30px; text-align: center; border-radius: 8px 8px 0 0;">
                    <h1 style="margin: 0; color: white; font-size: 28px; font-weight: 700;">Registration Cancelled</h1>
                    <p style="margin: 10px 0 0 0; color: rgba(255,255,255,0.9); font-size: 16px;">We're sorry to see you go</p>
                  </td>
                </tr>

                <!-- Body -->
                <tr>
                  <td style="padding: 40px 30px;">
                    <p style="margin: 0 0 20px 0; font-size: 16px; line-height: 1.6; color: #374151;">
                      Hi <strong>${playerName}</strong>,
                    </p>

                    <p style="margin: 0 0 20px 0; font-size: 16px; line-height: 1.6; color: #374151;">
                      Your registration for <strong>${tournamentName}</strong> has been cancelled.
                    </p>

                    ${wasRefunded && refundAmount ? `
                      <div style="background-color: #ecfdf5; border-left: 4px solid #10b981; padding: 20px; margin: 0 0 30px 0; border-radius: 4px;">
                        <h3 style="margin: 0 0 10px 0; font-size: 18px; color: #111827;">Refund Processed</h3>
                        <p style="margin: 0; font-size: 14px; color: #374151;">
                          A refund of <strong>$${(refundAmount / 100).toFixed(2)}</strong> has been processed and should appear in your account within 5-7 business days.
                        </p>
                      </div>
                    ` : ''}

                    <div style="background-color: #f9fafb; border-radius: 4px; padding: 20px; margin: 0 0 30px 0;">
                      <p style="margin: 0; font-size: 14px; line-height: 1.6; color: #374151;">
                        We hope to see you at future tournaments! You can browse upcoming events and register anytime from your dashboard.
                      </p>
                    </div>

                    <div style="text-align: center; margin: 30px 0;">
                      <a href="${tournamentLink}" style="display: inline-block; background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 600; margin-right: 10px;">View Tournament</a>
                      <a href="${baseUrl}/dashboard" style="display: inline-block; background-color: #6b7280; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 600;">Browse Tournaments</a>
                    </div>

                    <p style="margin: 20px 0 0 0; font-size: 14px; line-height: 1.6; color: #6b7280; text-align: center;">
                      Questions? Please contact the tournament organizers.
                    </p>
                  </td>
                </tr>

                <!-- Footer -->
                <tr>
                  <td style="background-color: #f9fafb; padding: 30px; text-align: center; border-radius: 0 0 8px 8px; border-top: 1px solid #e5e7eb;">
                    <p style="margin: 0; font-size: 12px; color: #9ca3af;">
                      This confirmation was sent to ${to}
                    </p>
                  </td>
                </tr>

              </table>
            </td>
          </tr>
        </table>
      </body>
    </html>
  `;

  await sendEmail({
    to,
    subject: `Registration Cancelled: ${tournamentName}`,
    html
  });
}

interface WaitlistSpotAvailableEmailParams {
  to: string;
  playerName: string;
  tournamentName: string;
  tournamentId: string;
  expiresAt: Date; // 24 hours from now
  tournamentStartDate?: Date | null;
  location?: string | null;
  isPaid: boolean;
  cost?: number | null; // in cents
}

export async function sendWaitlistSpotAvailableEmail(params: WaitlistSpotAvailableEmailParams) {
  const {
    to,
    playerName,
    tournamentName,
    tournamentId,
    expiresAt,
    tournamentStartDate,
    location,
    isPaid,
    cost
  } = params;

  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3010';
  const registerLink = `${baseUrl}/tournament/${tournamentId}`;

  const expiryTime = expiresAt.toLocaleString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  });

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Spot Available!</title>
      </head>
      <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f3f4f6;">
        <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f3f4f6; padding: 40px 20px;">
          <tr>
            <td align="center">
              <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 600px; background-color: white; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">

                <!-- Header -->
                <tr>
                  <td style="background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); padding: 40px 30px; text-align: center; border-radius: 8px 8px 0 0;">
                    <div style="font-size: 48px; margin-bottom: 10px;">🔥</div>
                    <h1 style="margin: 0; color: white; font-size: 28px; font-weight: 700;">A Spot Opened Up!</h1>
                    <p style="margin: 10px 0 0 0; color: rgba(255,255,255,0.9); font-size: 16px;">You're next on the waitlist</p>
                  </td>
                </tr>

                <!-- Body -->
                <tr>
                  <td style="padding: 40px 30px;">
                    <p style="margin: 0 0 20px 0; font-size: 16px; line-height: 1.6; color: #374151;">
                      Hi <strong>${playerName}</strong>,
                    </p>

                    <p style="margin: 0 0 20px 0; font-size: 16px; line-height: 1.6; color: #374151;">
                      Great news! A spot just opened up in <strong>${tournamentName}</strong>!
                    </p>

                    <div style="background-color: #fffbeb; border-left: 4px solid #f59e0b; padding: 20px; margin: 0 0 30px 0; border-radius: 4px;">
                      <h3 style="margin: 0 0 15px 0; font-size: 18px; color: #111827;">⏰ Act Fast - Limited Time Offer</h3>
                      <p style="margin: 0 0 10px 0; font-size: 14px; color: #92400e;">
                        You have <strong>24 hours</strong> to register for this spot.
                      </p>
                      <p style="margin: 0; font-size: 14px; color: #92400e;">
                        <strong>Expires:</strong> ${expiryTime}
                      </p>
                    </div>

                    <div style="background-color: #f9fafb; border-radius: 4px; padding: 20px; margin: 0 0 30px 0;">
                      <h3 style="margin: 0 0 15px 0; font-size: 18px; color: #111827;">Tournament Details</h3>

                      ${tournamentStartDate ? `
                        <div style="margin: 10px 0; font-size: 14px; color: #374151;">
                          <strong>📅 Date:</strong> ${tournamentStartDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
                        </div>
                      ` : ''}

                      ${location ? `
                        <div style="margin: 10px 0; font-size: 14px; color: #374151;">
                          <strong>📍 Location:</strong> ${location}
                        </div>
                      ` : ''}

                      ${isPaid && cost ? `
                        <div style="margin: 10px 0; font-size: 14px; color: #374151;">
                          <strong>💳 Cost:</strong> $${(cost / 100).toFixed(2)} per player
                        </div>
                      ` : `
                        <div style="margin: 10px 0; font-size: 14px; color: #374151;">
                          <strong>💰 Cost:</strong> Free
                        </div>
                      `}
                    </div>

                    <div style="text-align: center; margin: 30px 0;">
                      <a href="${registerLink}" style="display: inline-block; background-color: #f59e0b; color: white; padding: 16px 32px; text-decoration: none; border-radius: 6px; font-weight: 700; font-size: 16px;">Register Now</a>
                    </div>

                    <div style="background-color: #fef3c7; border-radius: 4px; padding: 15px; margin: 0 0 20px 0;">
                      <p style="margin: 0; font-size: 13px; line-height: 1.5; color: #92400e; text-align: center;">
                        ⚠️ If you don't register within 24 hours, this spot will be offered to the next person on the waitlist.
                      </p>
                    </div>

                    <p style="margin: 0; font-size: 14px; line-height: 1.6; color: #6b7280; text-align: center;">
                      Don't miss out on this opportunity!
                    </p>
                  </td>
                </tr>

                <!-- Footer -->
                <tr>
                  <td style="background-color: #f9fafb; padding: 30px; text-align: center; border-radius: 0 0 8px 8px; border-top: 1px solid #e5e7eb;">
                    <p style="margin: 0; font-size: 12px; color: #9ca3af;">
                      This notification was sent to ${to}
                    </p>
                  </td>
                </tr>

              </table>
            </td>
          </tr>
        </table>
      </body>
    </html>
  `;

  await sendEmail({
    to,
    subject: `🔥 Spot Available: ${tournamentName} (24h to register)`,
    html
  });
}

interface AdminNotificationEmailParams {
  to: string;
  adminName: string;
  playerName: string;
  playerEmail: string;
  tournamentName: string;
  tournamentId: string;
  action: 'registered' | 'requested_invite' | 'cancelled';
  isPaid?: boolean;
  amountPaid?: number | null; // in cents
}

export async function sendAdminNotificationEmail(params: AdminNotificationEmailParams) {
  const {
    to,
    adminName,
    playerName,
    playerEmail,
    tournamentName,
    tournamentId,
    action,
    isPaid,
    amountPaid
  } = params;

  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3010';
  const tournamentLink = `${baseUrl}/tournaments?edit=${tournamentId}`;

  const actionDetails = {
    registered: {
      icon: '✅',
      title: 'New Registration',
      message: `${playerName} just registered for your tournament!`,
      color: '#10b981'
    },
    requested_invite: {
      icon: '📨',
      title: 'Invite Request',
      message: `${playerName} has requested an invitation to your tournament.`,
      color: '#2563eb'
    },
    cancelled: {
      icon: '❌',
      title: 'Registration Cancelled',
      message: `${playerName} cancelled their registration.`,
      color: '#6b7280'
    }
  };

  const detail = actionDetails[action];

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${detail.title}</title>
      </head>
      <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f3f4f6;">
        <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f3f4f6; padding: 40px 20px;">
          <tr>
            <td align="center">
              <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 600px; background-color: white; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">

                <!-- Header -->
                <tr>
                  <td style="background-color: ${detail.color}; padding: 30px; text-align: center; border-radius: 8px 8px 0 0;">
                    <div style="font-size: 48px; margin-bottom: 10px;">${detail.icon}</div>
                    <h1 style="margin: 0; color: white; font-size: 24px; font-weight: 700;">${detail.title}</h1>
                  </td>
                </tr>

                <!-- Body -->
                <tr>
                  <td style="padding: 40px 30px;">
                    <p style="margin: 0 0 20px 0; font-size: 16px; line-height: 1.6; color: #374151;">
                      Hi <strong>${adminName}</strong>,
                    </p>

                    <p style="margin: 0 0 30px 0; font-size: 16px; line-height: 1.6; color: #374151;">
                      ${detail.message}
                    </p>

                    <div style="background-color: #f9fafb; border-radius: 4px; padding: 20px; margin: 0 0 30px 0;">
                      <h3 style="margin: 0 0 15px 0; font-size: 18px; color: #111827;">Player Details</h3>
                      <div style="margin: 8px 0; font-size: 14px; color: #374151;">
                        <strong>Name:</strong> ${playerName}
                      </div>
                      <div style="margin: 8px 0; font-size: 14px; color: #374151;">
                        <strong>Email:</strong> ${playerEmail}
                      </div>
                      <div style="margin: 8px 0; font-size: 14px; color: #374151;">
                        <strong>Tournament:</strong> ${tournamentName}
                      </div>
                      ${isPaid && amountPaid ? `
                        <div style="margin: 8px 0; font-size: 14px; color: #374151;">
                          <strong>Payment:</strong> $${(amountPaid / 100).toFixed(2)} paid
                        </div>
                      ` : ''}
                    </div>

                    <div style="text-align: center; margin: 30px 0;">
                      <a href="${tournamentLink}" style="display: inline-block; background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 600;">Manage Tournament</a>
                    </div>

                    <p style="margin: 0; font-size: 14px; line-height: 1.6; color: #6b7280; text-align: center;">
                      View all ${action === 'requested_invite' ? 'invite requests' : 'registrations'} from your tournament admin panel.
                    </p>
                  </td>
                </tr>

                <!-- Footer -->
                <tr>
                  <td style="background-color: #f9fafb; padding: 30px; text-align: center; border-radius: 0 0 8px 8px; border-top: 1px solid #e5e7eb;">
                    <p style="margin: 0; font-size: 12px; color: #9ca3af;">
                      This notification was sent to ${to}
                    </p>
                  </td>
                </tr>

              </table>
            </td>
          </tr>
        </table>
      </body>
    </html>
  `;

  await sendEmail({
    to,
    subject: `${detail.icon} ${detail.title}: ${tournamentName}`,
    html
  });
}

/**
 * Send tournament invite email
 */
interface InviteEmailParams {
  to: string;
  playerName: string;
  tournamentName: string;
  tournamentId: string;
  inviteId: string;
  inviteToken?: string; // For email-based invites (new players)
  expiresAt: Date;
  startDate?: Date | null;
  endDate?: Date | null;
  location?: string | null;
  notes?: string | null;
}

export async function sendInviteEmail(params: InviteEmailParams) {
  const {
    to,
    playerName,
    tournamentName,
    tournamentId,
    inviteId,
    inviteToken,
    expiresAt,
    startDate,
    endDate,
    location,
    notes,
  } = params;

  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3010';

  // Different links for existing players vs email invites
  const acceptLink = inviteToken
    ? `${baseUrl}/signup?invite=${inviteToken}`
    : `${baseUrl}/player/invites/${inviteId}/accept`;

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
      </head>
      <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f3f4f6;">
        <table role="presentation" style="width: 100%; border-collapse: collapse;">
          <tr>
            <td align="center" style="padding: 40px 0;">
              <table role="presentation" style="width: 600px; max-width: 100%; border-collapse: collapse; background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">

                <!-- Header with gradient background -->
                <tr>
                  <td style="padding: 40px 32px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); text-align: center;">
                    <div style="font-size: 48px; margin-bottom: 16px;">✉️</div>
                    <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: 600;">
                      You're Invited!
                    </h1>
                  </td>
                </tr>

                <!-- Body Content -->
                <tr>
                  <td style="padding: 32px;">
                    <p style="margin: 0 0 24px 0; font-size: 16px; line-height: 24px; color: #374151;">
                      Hi ${playerName},
                    </p>

                    <p style="margin: 0 0 24px 0; font-size: 16px; line-height: 24px; color: #374151;">
                      You've been invited to join <strong style="color: #111827;">${tournamentName}</strong>!
                    </p>

                    ${notes ? `
                      <div style="background-color: #f9fafb; border-left: 4px solid #667eea; padding: 16px; margin: 0 0 24px 0; border-radius: 4px;">
                        <p style="margin: 0; font-size: 14px; line-height: 20px; color: #6b7280; font-style: italic;">
                          "${notes}"
                        </p>
                      </div>
                    ` : ''}

                    <!-- Tournament Details -->
                    <div style="background-color: #f9fafb; border-radius: 6px; padding: 20px; margin: 0 0 24px 0;">
                      <h2 style="margin: 0 0 16px 0; font-size: 18px; font-weight: 600; color: #111827;">
                        Tournament Details
                      </h2>

                      ${startDate ? `
                        <div style="margin-bottom: 12px;">
                          <span style="font-weight: 500; color: #6b7280;">📅 Dates:</span>
                          <span style="color: #374151; margin-left: 8px;">
                            ${startDate.toLocaleDateString()}${endDate && endDate.getTime() !== startDate.getTime() ? ` - ${endDate.toLocaleDateString()}` : ''}
                          </span>
                        </div>
                      ` : ''}

                      ${location ? `
                        <div style="margin-bottom: 12px;">
                          <span style="font-weight: 500; color: #6b7280;">📍 Location:</span>
                          <span style="color: #374151; margin-left: 8px;">${location}</span>
                        </div>
                      ` : ''}

                      <div>
                        <span style="font-weight: 500; color: #6b7280;">⏰ Invite Expires:</span>
                        <span style="color: #374151; margin-left: 8px;">${expiresAt.toLocaleDateString()} at ${expiresAt.toLocaleTimeString()}</span>
                      </div>
                    </div>

                    <!-- CTA Button -->
                    <table role="presentation" style="width: 100%; margin: 0 0 24px 0;">
                      <tr>
                        <td align="center">
                          <a href="${acceptLink}"
                             style="display: inline-block; padding: 14px 32px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: #ffffff; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 16px;">
                            ${inviteToken ? 'Sign Up & Accept Invite' : 'Accept Invite'}
                          </a>
                        </td>
                      </tr>
                    </table>

                    ${inviteToken ? `
                      <p style="margin: 0 0 16px 0; font-size: 14px; line-height: 20px; color: #6b7280; text-align: center;">
                        New to our platform? Click the button above to create your account and accept the invite in one step.
                      </p>
                    ` : ''}

                    <p style="margin: 24px 0 0 0; font-size: 14px; line-height: 20px; color: #6b7280;">
                      This invite will expire on ${expiresAt.toLocaleDateString()}. Make sure to respond before then!
                    </p>
                  </td>
                </tr>

                <!-- Footer -->
                <tr>
                  <td style="padding: 24px 32px; background-color: #f9fafb; border-top: 1px solid #e5e7eb;">
                    <p style="margin: 0; font-size: 12px; color: #6b7280; text-align: center;">
                      Questions about this tournament? Contact the tournament organizer for more information.
                    </p>
                  </td>
                </tr>

              </table>
            </td>
          </tr>
        </table>
      </body>
    </html>
  `;

  await sendEmail({
    to,
    subject: `✉️ Tournament Invite: ${tournamentName}`,
    html
  });
}

/**
 * Send registration rejection email
 */
interface RejectionEmailParams {
  to: string;
  playerName: string;
  tournamentName: string;
  tournamentId: string;
  reason: string;
  wasRefunded: boolean;
  refundAmount?: number | null; // in cents
}

export async function sendRejectionEmail(params: RejectionEmailParams) {
  const {
    to,
    playerName,
    tournamentName,
    tournamentId,
    reason,
    wasRefunded,
    refundAmount,
  } = params;

  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3010';
  const tournamentLink = `${baseUrl}/tournaments/${tournamentId}`;
  const browseTournamentsLink = `${baseUrl}/dashboard`;

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
      </head>
      <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f3f4f6;">
        <table role="presentation" style="width: 100%; border-collapse: collapse;">
          <tr>
            <td align="center" style="padding: 40px 0;">
              <table role="presentation" style="width: 600px; max-width: 100%; border-collapse: collapse; background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">

                <!-- Header with red gradient background -->
                <tr>
                  <td style="padding: 40px 32px; background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%); text-align: center;">
                    <div style="font-size: 48px; margin-bottom: 16px;">✖️</div>
                    <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: 600;">
                      Registration Not Approved
                    </h1>
                  </td>
                </tr>

                <!-- Body Content -->
                <tr>
                  <td style="padding: 32px;">
                    <p style="margin: 0 0 24px 0; font-size: 16px; line-height: 24px; color: #374151;">
                      Hi ${playerName},
                    </p>

                    <p style="margin: 0 0 24px 0; font-size: 16px; line-height: 24px; color: #374151;">
                      Unfortunately, your registration for <strong style="color: #111827;">${tournamentName}</strong> was not approved.
                    </p>

                    <!-- Reason Box -->
                    <div style="background-color: #fef2f2; border-left: 4px solid: #ef4444; padding: 16px; margin: 0 0 24px 0; border-radius: 4px;">
                      <p style="margin: 0 0 8px 0; font-weight: 600; color: #991b1b;">Reason:</p>
                      <p style="margin: 0; font-size: 14px; line-height: 20px; color: #991b1b;">
                        ${reason}
                      </p>
                    </div>

                    ${wasRefunded && refundAmount ? `
                      <div style="background-color: #f0fdf4; border-left: 4px solid #10b981; padding: 16px; margin: 0 0 24px 0; border-radius: 4px;">
                        <p style="margin: 0; font-size: 14px; line-height: 20px; color: #065f46;">
                          <strong>Refund Issued:</strong> $${(refundAmount / 100).toFixed(2)}<br/>
                          Please allow 5-7 business days for the refund to appear in your account.
                        </p>
                      </div>
                    ` : ''}

                    <p style="margin: 0 0 24px 0; font-size: 16px; line-height: 24px; color: #374151;">
                      We appreciate your interest and encourage you to check out other tournaments that might be a better fit.
                    </p>

                    <!-- CTA Buttons -->
                    <table role="presentation" style="width: 100%; margin: 0 0 24px 0;">
                      <tr>
                        <td align="center" style="padding-bottom: 12px;">
                          <a href="${browseTournamentsLink}"
                             style="display: inline-block; padding: 14px 32px; background-color: #3b82f6; color: #ffffff; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 16px;">
                            Browse Other Tournaments
                          </a>
                        </td>
                      </tr>
                    </table>

                    <p style="margin: 24px 0 0 0; font-size: 14px; line-height: 20px; color: #6b7280;">
                      If you have questions about this decision, please contact the tournament organizer.
                    </p>
                  </td>
                </tr>

                <!-- Footer -->
                <tr>
                  <td style="padding: 24px 32px; background-color: #f9fafb; border-top: 1px solid #e5e7eb;">
                    <p style="margin: 0; font-size: 12px; color: #6b7280; text-align: center;">
                      Thank you for your understanding.
                    </p>
                  </td>
                </tr>

              </table>
            </td>
          </tr>
        </table>
      </body>
    </html>
  `;

  await sendEmail({
    to,
    subject: `Registration Not Approved: ${tournamentName}`,
    html
  });
}
