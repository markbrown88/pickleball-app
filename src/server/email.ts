import { Resend } from 'resend';

interface SendEmailOptions {
  to: string;
  subject: string;
  html: string;
  from?: string;
  bcc?: string | string[];
}

export async function sendEmail(options: SendEmailOptions) {
  const hasResendKey = !!process.env.RESEND_API_KEY;
  
  // Determine from address - use env var, then option, then default to verified domain
  const fromAddress = options.from || process.env.RESEND_FROM_ADDRESS || 'Klyng Cup Tournaments <no-reply@klyngcup.com>';
  
  if (!hasResendKey) {
    return;
  }

  try {
    const resend = new Resend(process.env.RESEND_API_KEY);
    const emailData: any = {
      from: fromAddress,
      to: options.to,
      subject: options.subject,
      html: options.html
    };
    
    // Add BCC if provided
    if (options.bcc) {
      emailData.bcc = Array.isArray(options.bcc) ? options.bcc : [options.bcc];
    }
    
    const result = await resend.emails.send(emailData);


    return result;
  } catch (error) {
    console.error('[Email send failed]', {
      to: options.to,
      subject: options.subject,
      from: fromAddress,
      error: error instanceof Error ? error.message : 'Unknown error',
      errorDetails: error,
    });
    throw error;
  }
}

export async function sendCaptainInviteEmail(to: string, link: string) {
  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Team Captain Access</title>
      </head>
      <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f3f4f6;">
        <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f3f4f6; padding: 40px 20px;">
          <tr>
            <td align="center">
              <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 600px; background-color: white; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">

                <!-- Logo -->
                <tr style="background-color: #111827;">
                  <td style="padding: 30px 30px 0 30px; text-align: center;">
                    <img src="https://klyngcup.com/images/klyng-cup.png" alt="Klyng Cup" style="max-width: 150px; height: auto; margin-bottom: 20px;" />
                  </td>
                </tr>

                <!-- Header -->
                <tr>
                  <td style="background: linear-gradient(135deg, #2563eb 0%, #1e40af 100%); padding: 0px 20px 15px; text-align: center; border-radius: 0; margin-top: 20px;">
                    <div style="font-size: 48px; margin-bottom: 10px;">👨‍✈️</div>
                    <h1 style="margin: 0; color: white; font-size: 28px; font-weight: 700;">Team Captain Access</h1>
                    <p style="margin: 10px 0 0 0; color: rgba(255,255,255,0.9); font-size: 16px;">Manage your team</p>
                  </td>
                </tr>

                <!-- Body -->
                <tr>
                  <td style="padding: 40px 30px;">
                    <p style="margin: 0 0 20px 0; font-size: 16px; line-height: 1.6; color: #374151;">
                      Hi <strong>Captain</strong>,
                    </p>

                    <p style="margin: 0 0 20px 0; font-size: 16px; line-height: 1.6; color: #374151;">
                      You've been designated as a team captain! Use the link below to access your team management dashboard where you can view and manage your team members.
                    </p>

                    <div style="background-color: #f0f9ff; border-left: 4px solid #2563eb; padding: 20px; margin: 0 0 30px 0; border-radius: 4px;">
                      <h3 style="margin: 0 0 15px 0; font-size: 18px; color: #111827;">Captain Responsibilities</h3>
                      <ul style="margin: 0; padding-left: 20px; font-size: 14px; line-height: 1.8; color: #374151;">
                        <li>Manage team roster and lineup</li>
                        <li>Communicate with team members</li>
                        <li>Coordinate match schedules</li>
                        <li>View team standings and results</li>
                      </ul>
                    </div>

                    <div style="text-align: center; margin: 30px 0;">
                      <a href="${link}" style="display: inline-block; background-color: #2563eb; color: white; padding: 14px 32px; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 16px;">Access Team Dashboard</a>
                    </div>

                    <p style="margin: 20px 0 0 0; font-size: 14px; line-height: 1.6; color: #6b7280;">
                      If you have any questions about your captain duties, please contact the tournament organizers.
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
    subject: 'Team Captain Access - Manage Your Team',
    html
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

                <!-- Logo -->
                <tr style="background-color: #111827;">
                  <td style="padding: 30px 30px 0 30px; text-align: center;">
                    <img src="https://klyngcup.com/images/klyng-cup.png" alt="Klyng Cup" style="max-width: 150px; height: auto; margin-bottom: 20px;" />
                  </td>
                </tr>

                <!-- Header -->
                <tr>
                  <td style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 0px 20px 15px; text-align: center; border-radius: 0;">
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
                      See you on the court! 🏓
                    </p>
                    <p style="margin: 0; font-size: 12px; color: #9ca3af;">
                      This invitation was sent to ${to}
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
  stops?: Array<{
    id: string;
    name: string;
    startAt: Date | null;
    endAt: Date | null;
    bracketName?: string | null;
    club?: {
      name: string;
      address?: string | null;
      address1?: string | null;
      city?: string | null;
      region?: string | null;
      postalCode?: string | null;
    } | null;
  }>;
  clubName?: string | null;
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
    registrationDate,
    stops,
    clubName,
  } = params;

  // Format date for email: Fri., Nov. 21 - Sat., Nov. 22, 2025
  const formatEmailDate = (date: Date | null | undefined) => {
    if (!date) return '';
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const dayName = dayNames[date.getUTCDay()];
    const month = monthNames[date.getUTCMonth()];
    const day = date.getUTCDate();
    const year = date.getUTCFullYear();
    return `${dayName}., ${month}. ${day}, ${year}`;
  };

  const formatEmailDateRange = (start: Date | null | undefined, end: Date | null | undefined) => {
    if (!start && !end) return '';
    if (!start) return formatEmailDate(end);
    if (!end) return formatEmailDate(start);
    
    const startFormatted = formatEmailDate(start);
    const endFormatted = formatEmailDate(end);
    
    // If same day, return single date
    if (start.toDateString() === end.toDateString()) {
      return startFormatted;
    }
    
    // Extract parts for formatting
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    
    const startDayName = dayNames[start.getUTCDay()];
    const startMonth = monthNames[start.getUTCMonth()];
    const startDay = start.getUTCDate();
    
    const endDayName = dayNames[end.getUTCDay()];
    const endMonth = monthNames[end.getUTCMonth()];
    const endDay = end.getUTCDate();
    const endYear = end.getUTCFullYear();
    
    // If same month, format: Fri., Nov. 21 - Sat., Nov. 22, 2025
    if (start.getUTCMonth() === end.getUTCMonth() && start.getUTCFullYear() === end.getUTCFullYear()) {
      return `${startDayName}., ${startMonth}. ${startDay} - ${endDayName}., ${endMonth}. ${endDay}, ${endYear}`;
    }
    
    // Different months: Fri., Nov. 21 - Sat., Dec. 12, 2025
    return `${startDayName}., ${startMonth}. ${startDay} - ${endDayName}., ${endMonth}. ${endDay}, ${endYear}`;
  };

  // Build Google Maps URL from address components
  const buildGoogleMapsUrl = (club: { address?: string | null; address1?: string | null; city?: string | null; region?: string | null; postalCode?: string | null; name: string } | null | undefined) => {
    if (!club) return '';
    // Use address1 if available, otherwise use address field
    const streetAddress = club.address1 || club.address;
    const parts = [
      streetAddress,
      club.city,
      club.region,
      club.postalCode,
      'Canada'
    ].filter(Boolean);
    if (parts.length === 0) return '';
    const query = encodeURIComponent(parts.join(', '));
    return `https://www.google.com/maps/search/?api=1&query=${query}`;
  };

  // Format full address
  const formatFullAddress = (club: { address?: string | null; address1?: string | null; city?: string | null; region?: string | null; postalCode?: string | null; name: string } | null | undefined) => {
    if (!club) return '';
    // Use address1 if available, otherwise use address field
    const streetAddress = club.address1 || club.address;
    const parts = [
      streetAddress,
      club.city,
      club.region,
      club.postalCode
    ].filter(Boolean);
    return parts.join(', ');
  };

  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3010';
  const tournamentLink = `${baseUrl}/tournament/${tournamentId}`;
  const dashboardLink = `${baseUrl}/dashboard`;

  // Build stops list HTML if stops are provided
  const stopsListHtml = stops && stops.length > 0
    ? `
      <div style="margin: 20px 0;">
        <h3 style="margin: 0 0 15px 0; font-size: 18px; color: #111827;">Your Tournament Selections:</h3>
        ${clubName ? `
          <div style="margin: 0 0 20px 0; font-size: 14px; color: #374151;">
            <strong>Representing:</strong> ${clubName}
          </div>
        ` : ''}
        ${stops.map((stop) => {
          const mapsUrl = stop.club ? buildGoogleMapsUrl(stop.club) : '';
          const locationDisplay = stop.club
            ? `${stop.club.name}${stop.club.city && stop.club.region ? `, ${stop.club.city}, ${stop.club.region}` : stop.club.city ? `, ${stop.club.city}` : ''}`
            : '';

          return `
            <div style="margin: 0 0 25px 0;">
              ${stops.length > 1 ? `<div style="font-weight: 600; color: #111827; font-size: 16px; margin-bottom: 8px;">${stop.name}</div>` : ''}
              ${locationDisplay ? `
                <div style="margin: 4px 0; font-size: 14px; color: #374151;">
                  <strong>📍 Location:</strong> ${mapsUrl ? `<a href="${mapsUrl}" style="color: #2563eb; text-decoration: none;">${locationDisplay}</a>` : locationDisplay}
                </div>
              ` : ''}
              <div style="margin: 4px 0; font-size: 14px; color: #374151;">
                <strong>📅 Dates:</strong> ${formatEmailDateRange(stop.startAt, stop.endAt)}
              </div>
              ${stop.bracketName ? `
                <div style="margin: 4px 0; font-size: 14px; color: #374151;">
                  <strong>Bracket:</strong> ${stop.bracketName}
                </div>
              ` : ''}
            </div>
          `;
        }).join('')}
      </div>
    `
    : '';

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

                <!-- Logo -->
                <tr style="background-color: #111827;">
                  <td style="padding: 30px 30px 0 30px; text-align: center;">
                    <img src="https://klyngcup.com/images/klyng-cup.png" alt="Klyng Cup" style="max-width: 150px; height: auto; margin-bottom: 20px;" />
                  </td>
                </tr>

                <!-- Header -->
                <tr>
                  <td style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); padding: 0px 20px 15px; text-align: center; border-radius: 0;">
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
                      <h2 style="margin: 0 0 20px 0; font-size: 22px; color: #111827;">${tournamentName}</h2>

                      ${stopsListHtml}

                      <div style="margin: 20px 0 0 0; font-size: 14px; color: #374151;">
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
                        <li>Check your <a href="${dashboardLink}" style="color: #2563eb; text-decoration: none;">dashboard</a> for tournament updates</li>
                        <li>Bring your paddle and a positive attitude!</li>
                        <li>You can view tournament scores or cancel your registration from your <a href="${dashboardLink}" style="color: #2563eb; text-decoration: none;">dashboard</a></li>
                      </ul>
                    </div>

                    <div style="text-align: center; margin: 30px 0;">
                      <a href="${tournamentLink}" style="display: inline-block; background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 600;">View Scores</a>
                    </div>

                    <p style="margin: 20px 0 0 0; font-size: 14px; line-height: 1.6; color: #6b7280;">
                      Need to make changes? You can cancel your registration from your <a href="${dashboardLink}" style="color: #2563eb; text-decoration: none;">dashboard</a> anytime before the tournament starts.
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
    html,
    from: 'Klyng Cup Tournaments <no-reply@klyngcup.com>'
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

                <!-- Logo -->
                <tr style="background-color: #111827;">
                  <td style="padding: 30px 30px 0 30px; text-align: center;">
                    <img src="https://klyngcup.com/images/klyng-cup.png" alt="Klyng Cup" style="max-width: 150px; height: auto; margin-bottom: 20px;" />
                  </td>
                </tr>

                <!-- Header -->
                <tr>
                  <td style="background: linear-gradient(135deg, #6b7280 0%, #4b5563 100%); padding: 0px 20px 15px; text-align: center; border-radius: 0;">
                    <div style="font-size: 48px; margin-bottom: 10px;">👋</div>
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
                      <a href="${tournamentLink}" style="display: inline-block; background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 600; margin-right: 10px;">View Scores</a>
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

                <!-- Logo -->
                <tr style="background-color: #111827;">
                  <td style="padding: 30px 30px 0 30px; text-align: center;">
                    <img src="https://klyngcup.com/images/klyng-cup.png" alt="Klyng Cup" style="max-width: 150px; height: auto; margin-bottom: 20px;" />
                  </td>
                </tr>

                <!-- Header -->
                <tr>
                  <td style="background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); padding: 0px 20px 15px; text-align: center; border-radius: 0;">
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
                    <p style="margin: 0 0 10px 0; font-size: 12px; color: #9ca3af;">
                      See you on the court! 🏓
                    </p>
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

                <!-- Logo -->
                <tr style="background-color: #111827;">
                  <td style="padding: 30px 30px 0 30px; text-align: center;">
                    <img src="https://klyngcup.com/images/klyng-cup.png" alt="Klyng Cup" style="max-width: 150px; height: auto; margin-bottom: 20px;" />
                  </td>
                </tr>

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
                    <p style="margin: 0 0 10px 0; font-size: 12px; color: #9ca3af;">
                      See you on the court! 🏓
                    </p>
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
                  <td style="padding: 20px 32px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); text-align: center;">
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
                    <p style="margin: 0 0 10px 0; font-size: 12px; color: #6b7280; text-align: center;">
                      See you on the court! 🏓
                    </p>
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
                  <td style="padding: 20px 32px; background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%); text-align: center;">
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

/**
 * Send payment receipt email
 */
interface PaymentReceiptEmailParams {
  to: string;
  playerName: string;
  tournamentName: string;
  tournamentId: string;
  amountPaid: number; // in cents
  paymentDate: Date;
  transactionId?: string;
  startDate?: Date | null;
  endDate?: Date | null;
  location?: string | null;
  stops?: Array<{
    id: string;
    name: string;
    startAt: Date | null;
    endAt: Date | null;
    bracketName?: string | null;
    club?: {
      name: string;
      address?: string | null;
      address1?: string | null;
      city?: string | null;
      region?: string | null;
      postalCode?: string | null;
    } | null;
  }>;
  clubName?: string | null;
}

export async function sendPaymentReceiptEmail(params: PaymentReceiptEmailParams) {
  const {
    to,
    playerName,
    tournamentName,
    tournamentId,
    amountPaid,
    paymentDate,
    transactionId,
    startDate,
    endDate,
    location,
    stops,
    clubName,
  } = params;

  // Always use production URL, never localhost
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_BASE_URL || 'https://klyngcup.com';
  // Ensure we never use localhost in production emails
  const tournamentLink = baseUrl.includes('localhost') 
    ? `https://klyngcup.com/tournament/${tournamentId}`
    : `${baseUrl}/tournament/${tournamentId}`;

  // Format date for email: Fri., Nov. 21 - Sat., Nov. 22, 2025
  const formatEmailDate = (date: Date | null | undefined) => {
    if (!date) return '';
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const dayName = dayNames[date.getUTCDay()];
    const month = monthNames[date.getUTCMonth()];
    const day = date.getUTCDate();
    const year = date.getUTCFullYear();
    return `${dayName}., ${month}. ${day}, ${year}`;
  };

  const formatEmailDateRange = (start: Date | null | undefined, end: Date | null | undefined) => {
    if (!start && !end) return '';
    if (!start) return formatEmailDate(end);
    if (!end) return formatEmailDate(start);
    
    const startFormatted = formatEmailDate(start);
    const endFormatted = formatEmailDate(end);
    
    // If same day, return single date
    if (start.toDateString() === end.toDateString()) {
      return startFormatted;
    }
    
    // Extract parts for formatting
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    
    const startDayName = dayNames[start.getUTCDay()];
    const startMonth = monthNames[start.getUTCMonth()];
    const startDay = start.getUTCDate();
    
    const endDayName = dayNames[end.getUTCDay()];
    const endMonth = monthNames[end.getUTCMonth()];
    const endDay = end.getUTCDate();
    const endYear = end.getUTCFullYear();
    
    // If same month, format: Fri., Nov. 21 - Sat., Nov. 22, 2025
    if (start.getUTCMonth() === end.getUTCMonth() && start.getUTCFullYear() === end.getUTCFullYear()) {
      return `${startDayName}., ${startMonth}. ${startDay} - ${endDayName}., ${endMonth}. ${endDay}, ${endYear}`;
    }
    
    // Different months: Fri., Nov. 21 - Sat., Dec. 12, 2025
    return `${startDayName}., ${startMonth}. ${startDay} - ${endDayName}., ${endMonth}. ${endDay}, ${endYear}`;
  };

  // Build Google Maps URL from address components
  const buildGoogleMapsUrl = (club: { address?: string | null; address1?: string | null; city?: string | null; region?: string | null; postalCode?: string | null; name: string } | null | undefined) => {
    if (!club) return '';
    // Use address1 if available, otherwise use address field
    const streetAddress = club.address1 || club.address;
    const parts = [
      streetAddress,
      club.city,
      club.region,
      club.postalCode,
      'Canada'
    ].filter(Boolean);
    if (parts.length === 0) return '';
    const query = encodeURIComponent(parts.join(', '));
    return `https://www.google.com/maps/search/?api=1&query=${query}`;
  };

  // Format full address
  const formatFullAddress = (club: { address?: string | null; address1?: string | null; city?: string | null; region?: string | null; postalCode?: string | null; name: string } | null | undefined) => {
    if (!club) return '';
    // Use address1 if available, otherwise use address field
    const streetAddress = club.address1 || club.address;
    const parts = [
      streetAddress,
      club.city,
      club.region,
      club.postalCode
    ].filter(Boolean);
    return parts.join(', ');
  };

  // Build stops list HTML if stops are provided
  const stopsListHtml = stops && stops.length > 0
    ? `
      <div style="margin: 20px 0;">
        ${stops.map((stop, index) => {
          const fullAddress = stop.club ? formatFullAddress(stop.club) : '';
          const mapsUrl = stop.club ? buildGoogleMapsUrl(stop.club) : '';
          const locationDisplay = stop.club ? stop.club.name : '';
          const hasMultipleStops = stops.length > 1;
          const isTeamTournament = !!clubName;
          
          // Use full address for Google Maps link text if available
          // If full address is not available, try to build a partial address from available fields
          // Include club name + available address fields for better context
          let locationLinkText = fullAddress;
          if (!locationLinkText && stop.club) {
            // Build partial address from available fields, including club name
            // Use address1 if available, otherwise use address field
            const streetAddress = stop.club.address1 || stop.club.address;
            const partialParts = [
              streetAddress,
              stop.club.city,
              stop.club.region,
              stop.club.postalCode
            ].filter(Boolean);
            
            if (partialParts.length > 0) {
              // If we have address fields, include club name for context
              locationLinkText = `${locationDisplay}${partialParts.length > 0 ? ', ' + partialParts.join(', ') : ''}`;
            } else {
              // Fall back to just club name if no address fields
              locationLinkText = locationDisplay;
            }
          } else if (!locationLinkText) {
            locationLinkText = locationDisplay;
          }
          
          return `
            <div style="margin: ${index > 0 ? '30px' : '0'} 0 ${index < stops.length - 1 ? '30px' : '0'} 0;">
              <div style="margin: 4px 0; font-size: 14px; color: #374151;">
                <strong>Tournament:</strong> ${tournamentName}
              </div>
              ${hasMultipleStops ? `
                <div style="margin: 4px 0; font-size: 14px; color: #374151;">
                  <strong>Stop:</strong> ${stop.name}
                </div>
              ` : ''}
              ${isTeamTournament && clubName ? `
                <div style="margin: 4px 0; font-size: 14px; color: #374151;">
                  <strong>Team:</strong> ${clubName}
                </div>
              ` : ''}
              ${stop.bracketName ? `
                <div style="margin: 4px 0; font-size: 14px; color: #374151;">
                  <strong>Bracket:</strong> ${stop.bracketName}
                </div>
              ` : ''}
              ${locationDisplay && mapsUrl ? `
                <div style="margin: 4px 0; font-size: 14px; color: #374151;">
                  <strong>📍 Location:</strong> <a href="${mapsUrl}" style="color: #2563eb; text-decoration: none;">${locationLinkText}</a>
                </div>
              ` : locationDisplay ? `
                <div style="margin: 4px 0; font-size: 14px; color: #374151;">
                  <strong>📍 Location:</strong> ${locationDisplay}
                </div>
              ` : ''}
              <div style="margin: 4px 0; font-size: 14px; color: #374151;">
                <strong>📅 Dates:</strong> ${formatEmailDateRange(stop.startAt, stop.endAt)}
              </div>
            </div>
          `;
        }).join('')}
      </div>
    `
    : '';

  // Fallback date range for backward compatibility
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
        <title>Payment Receipt</title>
      </head>
      <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f3f4f6;">
        <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f3f4f6; padding: 40px 20px;">
          <tr>
            <td align="center">
              <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 600px; background-color: white; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">

                <!-- Logo -->
                <tr style="background-color: #111827;">
                  <td style="padding: 30px 30px 0 30px; text-align: center;">
                    <img src="https://klyngcup.com/images/klyng-cup.png" alt="Klyng Cup" style="max-width: 150px; height: auto; margin-bottom: 20px;" />
                  </td>
                </tr>

                <!-- Header -->
                <tr>
                  <td style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); padding: 0px 20px 15px; text-align: center; border-radius: 0;">
                    <div style="font-size: 48px; margin-bottom: 10px;">💳</div>
                    <h1 style="margin: 0; color: white; font-size: 28px; font-weight: 700;">Payment Confirmed!</h1>
                    <p style="margin: 10px 0 0 0; color: rgba(255,255,255,0.9); font-size: 16px;">Your payment has been processed</p>
                  </td>
                </tr>

                <!-- Body -->
                <tr>
                  <td style="padding: 40px 30px;">
                    <p style="margin: 0 0 20px 0; font-size: 16px; line-height: 1.6; color: #374151;">
                      Hi <strong>${playerName}</strong>,
                    </p>

                    <p style="margin: 0 0 20px 0; font-size: 16px; line-height: 1.6; color: #374151;">
                      Your payment for <strong>${tournamentName}</strong> has been successfully processed.
                    </p>

                    <div style="background-color: #ecfdf5; border-left: 4px solid #10b981; padding: 20px; margin: 0 0 30px 0; border-radius: 4px;">
                      <h2 style="margin: 0 0 15px 0; font-size: 22px; color: #111827;">${tournamentName}</h2>

                      <div style="margin: 10px 0; font-size: 14px; color: #374151;">
                        <strong>💰 Amount Paid:</strong> $${(amountPaid / 100).toFixed(2)}
                      </div>

                      ${stopsListHtml ? '' : (dateRange !== 'Dates TBD' ? `
                        <div style="margin: 10px 0; font-size: 14px; color: #374151;">
                          <strong>📅 Dates:</strong> ${dateRange}
                        </div>
                      ` : '')}

                      ${stopsListHtml ? '' : (location ? `
                        <div style="margin: 10px 0; font-size: 14px; color: #374151;">
                          <strong>📍 Location:</strong> ${location}
                        </div>
                      ` : '')}

                      <div style="margin: 10px 0; font-size: 14px; color: #374151;">
                        <strong>✓ Paid:</strong> ${paymentDate.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })} at ${paymentDate.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                      </div>

                      ${transactionId ? `
                        <div style="margin: 10px 0; font-size: 14px; color: #374151;">
                          <strong>🔢 Transaction ID:</strong> ${transactionId}
                        </div>
                      ` : ''}
                    </div>
                    ${stopsListHtml}

                    <div style="background-color: #f9fafb; border-radius: 4px; padding: 20px; margin: 0 0 30px 0;">
                      <h3 style="margin: 0 0 15px 0; font-size: 18px; color: #111827;">What's Next?</h3>
                      <ul style="margin: 0; padding-left: 20px; font-size: 14px; line-height: 1.8; color: #374151;">
                        <li>Your registration is now confirmed</li>
                        <li>Check your dashboard for tournament updates</li>
                        <li>Save this email as your payment receipt</li>
                      </ul>
                    </div>

                    <div style="text-align: center; margin: 30px 0;">
                      <a href="${tournamentLink}" style="display: inline-block; background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 600;">View Scores</a>
                    </div>

                    <p style="margin: 20px 0 0 0; font-size: 14px; line-height: 1.6; color: #6b7280;">
                      This is your payment receipt. Please keep this email for your records.
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
                      This receipt was sent to ${to}
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
    subject: `Payment Receipt: ${tournamentName}`,
    html,
    bcc: ['markbrown8@gmail.com', 'lily226@gmail.com'],
  });
}

/**
 * Send payment failed notification email
 */
interface PaymentFailedEmailParams {
  to: string;
  playerName: string;
  tournamentName: string;
  tournamentId: string;
  amount: number; // in cents
  failureReason?: string;
  startDate?: Date | null;
  endDate?: Date | null;
  location?: string | null;
}

export async function sendPaymentFailedEmail(params: PaymentFailedEmailParams) {
  const {
    to,
    playerName,
    tournamentName,
    tournamentId,
    amount,
    failureReason,
    startDate,
    endDate,
    location,
  } = params;

  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3010';
  const tournamentLink = `${baseUrl}/register/${tournamentId}`;

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
        <title>Payment Failed</title>
      </head>
      <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f3f4f6;">
        <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f3f4f6; padding: 40px 20px;">
          <tr>
            <td align="center">
              <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 600px; background-color: white; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">

                <!-- Logo -->
                <tr style="background-color: #111827;">
                  <td style="padding: 30px 30px 0 30px; text-align: center;">
                    <img src="https://klyngcup.com/images/klyng-cup.png" alt="Klyng Cup" style="max-width: 150px; height: auto; margin-bottom: 20px;" />
                  </td>
                </tr>

                <!-- Header -->
                <tr>
                  <td style="background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%); padding: 0px 20px 15px; text-align: center; border-radius: 0;">
                    <div style="font-size: 48px; margin-bottom: 10px;">⚠️</div>
                    <h1 style="margin: 0; color: white; font-size: 28px; font-weight: 700;">Payment Failed</h1>
                    <p style="margin: 10px 0 0 0; color: rgba(255,255,255,0.9); font-size: 16px;">Action required</p>
                  </td>
                </tr>

                <!-- Body -->
                <tr>
                  <td style="padding: 40px 30px;">
                    <p style="margin: 0 0 20px 0; font-size: 16px; line-height: 1.6; color: #374151;">
                      Hi <strong>${playerName}</strong>,
                    </p>

                    <p style="margin: 0 0 20px 0; font-size: 16px; line-height: 1.6; color: #374151;">
                      Unfortunately, your payment for <strong>${tournamentName}</strong> could not be processed.
                    </p>

                    <div style="background-color: #fef2f2; border-left: 4px solid #ef4444; padding: 20px; margin: 0 0 30px 0; border-radius: 4px;">
                      <h2 style="margin: 0 0 15px 0; font-size: 22px; color: #111827;">${tournamentName}</h2>

                      <div style="margin: 10px 0; font-size: 14px; color: #374151;">
                        <strong>💰 Amount:</strong> $${(amount / 100).toFixed(2)}
                      </div>

                      <div style="margin: 10px 0; font-size: 14px; color: #374151;">
                        <strong>📅 Dates:</strong> ${dateRange}
                      </div>

                      ${location ? `
                        <div style="margin: 10px 0; font-size: 14px; color: #374151;">
                          <strong>📍 Location:</strong> ${location}
                        </div>
                      ` : ''}

                      ${failureReason ? `
                        <div style="margin: 15px 0 0 0; padding-top: 15px; border-top: 1px solid #fecaca;">
                          <strong style="color: #991b1b;">Reason:</strong>
                          <p style="margin: 5px 0 0 0; color: #991b1b; font-size: 14px;">${failureReason}</p>
                        </div>
                      ` : ''}
                    </div>

                    <div style="background-color: #fffbeb; border-left: 4px solid #f59e0b; padding: 20px; margin: 0 0 30px 0; border-radius: 4px;">
                      <h3 style="margin: 0 0 10px 0; font-size: 18px; color: #92400e;">⏰ Important</h3>
                      <p style="margin: 0; font-size: 14px; line-height: 1.6; color: #92400e;">
                        Your registration is not confirmed until payment is successful. Please try again to secure your spot in the tournament.
                      </p>
                    </div>

                    <div style="text-align: center; margin: 30px 0;">
                      <a href="${tournamentLink}" style="display: inline-block; background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 600;">Try Payment Again</a>
                    </div>

                    <div style="background-color: #f9fafb; border-radius: 4px; padding: 20px; margin: 0 0 20px 0;">
                      <h3 style="margin: 0 0 15px 0; font-size: 18px; color: #111827;">Common Payment Issues</h3>
                      <ul style="margin: 0; padding-left: 20px; font-size: 14px; line-height: 1.8; color: #374151;">
                        <li>Insufficient funds in your account</li>
                        <li>Card expired or incorrect card details</li>
                        <li>Bank declined the transaction</li>
                        <li>Network issues during payment processing</li>
                      </ul>
                    </div>

                    <p style="margin: 20px 0 0 0; font-size: 14px; line-height: 1.6; color: #6b7280;">
                      If you continue to experience issues, please contact your bank or card issuer, or reach out to the tournament organizers for assistance.
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
    subject: `Payment Failed: ${tournamentName}`,
    html
  });
}

/**
 * Send refund confirmation email
 */
interface RefundConfirmationEmailParams {
  to: string;
  playerName: string;
  tournamentName: string;
  tournamentId: string;
  refundAmount: number; // in cents
  refundDate: Date;
  transactionId?: string;
  reason?: string;
}

export async function sendRefundConfirmationEmail(params: RefundConfirmationEmailParams) {
  const {
    to,
    playerName,
    tournamentName,
    tournamentId,
    refundAmount,
    refundDate,
    transactionId,
    reason,
  } = params;

  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3010';
  const tournamentLink = `${baseUrl}/tournament/${tournamentId}`;

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Refund Processed</title>
      </head>
      <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f3f4f6;">
        <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f3f4f6; padding: 40px 20px;">
          <tr>
            <td align="center">
              <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 600px; background-color: white; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">

                <!-- Logo -->
                <tr style="background-color: #111827;">
                  <td style="padding: 30px 30px 0 30px; text-align: center;">
                    <img src="https://klyngcup.com/images/klyng-cup.png" alt="Klyng Cup" style="max-width: 150px; height: auto; margin-bottom: 20px;" />
                  </td>
                </tr>

                <!-- Header -->
                <tr>
                  <td style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); padding: 0px 20px 15px; text-align: center; border-radius: 0;">
                    <div style="font-size: 48px; margin-bottom: 10px;">💰</div>
                    <h1 style="margin: 0; color: white; font-size: 28px; font-weight: 700;">Refund Processed</h1>
                    <p style="margin: 10px 0 0 0; color: rgba(255,255,255,0.9); font-size: 16px;">Your refund has been issued</p>
                  </td>
                </tr>

                <!-- Body -->
                <tr>
                  <td style="padding: 40px 30px;">
                    <p style="margin: 0 0 20px 0; font-size: 16px; line-height: 1.6; color: #374151;">
                      Hi <strong>${playerName}</strong>,
                    </p>

                    <p style="margin: 0 0 20px 0; font-size: 16px; line-height: 1.6; color: #374151;">
                      Your refund for <strong>${tournamentName}</strong> has been successfully processed.
                    </p>

                    <div style="background-color: #ecfdf5; border-left: 4px solid #10b981; padding: 20px; margin: 0 0 30px 0; border-radius: 4px;">
                      <h2 style="margin: 0 0 15px 0; font-size: 22px; color: #111827;">Refund Details</h2>

                      <div style="margin: 10px 0; font-size: 14px; color: #374151;">
                        <strong>💰 Refund Amount:</strong> $${(refundAmount / 100).toFixed(2)}
                      </div>

                      <div style="margin: 10px 0; font-size: 14px; color: #374151;">
                        <strong>📅 Processed:</strong> ${refundDate.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })} at ${refundDate.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                      </div>

                      ${transactionId ? `
                        <div style="margin: 10px 0; font-size: 14px; color: #374151;">
                          <strong>🔢 Transaction ID:</strong> ${transactionId}
                        </div>
                      ` : ''}

                      ${reason ? `
                        <div style="margin: 15px 0 0 0; padding-top: 15px; border-top: 1px solid #a7f3d0;">
                          <strong>Reason:</strong>
                          <p style="margin: 5px 0 0 0; color: #374151; font-size: 14px;">${reason}</p>
                        </div>
                      ` : ''}
                    </div>

                    <div style="background-color: #f0fdf4; border-left: 4px solid #10b981; padding: 20px; margin: 0 0 30px 0; border-radius: 4px;">
                      <h3 style="margin: 0 0 10px 0; font-size: 18px; color: #065f46;">⏰ Processing Time</h3>
                      <p style="margin: 0; font-size: 14px; line-height: 1.6; color: #065f46;">
                        The refund has been issued to your original payment method. Please allow <strong>5-7 business days</strong> for the refund to appear in your account.
                      </p>
                    </div>

                    <div style="text-align: center; margin: 30px 0;">
                      <a href="${tournamentLink}" style="display: inline-block; background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 600; margin-right: 10px;">View Scores</a>
                      <a href="${baseUrl}/dashboard" style="display: inline-block; background-color: #6b7280; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 600;">Browse Tournaments</a>
                    </div>

                    <p style="margin: 20px 0 0 0; font-size: 14px; line-height: 1.6; color: #6b7280;">
                      If you have any questions about this refund, please contact the tournament organizers.
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
    subject: `Refund Processed: ${tournamentName}`,
    html
  });
}

/**
 * Send payment reminder email
 */
interface PaymentReminderEmailParams {
  to: string;
  playerName: string;
  tournamentName: string;
  tournamentId: string;
  registrationId: string;
  amount: number; // in cents
  hoursRemaining: number; // hours until cancellation
  startDate?: Date | null;
  endDate?: Date | null;
  location?: string | null;
  stops?: Array<{
    id: string;
    name: string;
    startAt: Date | null;
    endAt: Date | null;
    bracketName?: string | null;
    club?: {
      name: string;
      address?: string | null;
      address1?: string | null;
      city?: string | null;
      region?: string | null;
      postalCode?: string | null;
    } | null;
  }>;
  clubName?: string | null;
}

export async function sendPaymentReminderEmail(params: PaymentReminderEmailParams) {
  const {
    to,
    playerName,
    tournamentName,
    tournamentId,
    registrationId,
    amount,
    hoursRemaining,
    startDate,
    endDate,
    location,
    stops,
    clubName,
  } = params;

  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3010';
  const paymentLink = `${baseUrl}/register/${tournamentId}/payment/status/${registrationId}`;
  const amountFormatted = `$${(amount / 100).toFixed(2)}`;

  // Format date for email: Fri., Nov. 21 - Sat., Nov. 22, 2025
  const formatEmailDate = (date: Date | null | undefined) => {
    if (!date) return '';
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const dayName = dayNames[date.getUTCDay()];
    const month = monthNames[date.getUTCMonth()];
    const day = date.getUTCDate();
    const year = date.getUTCFullYear();
    return `${dayName}., ${month}. ${day}, ${year}`;
  };

  const formatEmailDateRange = (start: Date | null | undefined, end: Date | null | undefined) => {
    if (!start && !end) return '';
    if (!start) return formatEmailDate(end);
    if (!end) return formatEmailDate(start);
    
    const startFormatted = formatEmailDate(start);
    const endFormatted = formatEmailDate(end);
    
    // If same day, return single date
    if (start.toDateString() === end.toDateString()) {
      return startFormatted;
    }
    
    // Extract parts for formatting
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    
    const startDayName = dayNames[start.getUTCDay()];
    const startMonth = monthNames[start.getUTCMonth()];
    const startDay = start.getUTCDate();
    
    const endDayName = dayNames[end.getUTCDay()];
    const endMonth = monthNames[end.getUTCMonth()];
    const endDay = end.getUTCDate();
    const endYear = end.getUTCFullYear();
    
    // If same month, format: Fri., Nov. 21 - Sat., Nov. 22, 2025
    if (start.getUTCMonth() === end.getUTCMonth() && start.getUTCFullYear() === end.getUTCFullYear()) {
      return `${startDayName}., ${startMonth}. ${startDay} - ${endDayName}., ${endMonth}. ${endDay}, ${endYear}`;
    }
    
    // Different months: Fri., Nov. 21 - Sat., Dec. 12, 2025
    return `${startDayName}., ${startMonth}. ${startDay} - ${endDayName}., ${endMonth}. ${endDay}, ${endYear}`;
  };

  // Build Google Maps URL from address components
  const buildGoogleMapsUrl = (club: { address?: string | null; address1?: string | null; city?: string | null; region?: string | null; postalCode?: string | null; name: string } | null | undefined) => {
    if (!club) return '';
    // Use address1 if available, otherwise use address field
    const streetAddress = club.address1 || club.address;
    const parts = [
      streetAddress,
      club.city,
      club.region,
      club.postalCode,
      'Canada'
    ].filter(Boolean);
    if (parts.length === 0) return '';
    const query = encodeURIComponent(parts.join(', '));
    return `https://www.google.com/maps/search/?api=1&query=${query}`;
  };

  // Format full address
  const formatFullAddress = (club: { address?: string | null; address1?: string | null; city?: string | null; region?: string | null; postalCode?: string | null; name: string } | null | undefined) => {
    if (!club) return '';
    // Use address1 if available, otherwise use address field
    const streetAddress = club.address1 || club.address;
    const parts = [
      streetAddress,
      club.city,
      club.region,
      club.postalCode
    ].filter(Boolean);
    return parts.join(', ');
  };

  // Build stops list HTML if stops are provided
  const stopsListHtml = stops && stops.length > 0
    ? `
      <div style="margin: 20px 0;">
        ${stops.map((stop, index) => {
          const fullAddress = stop.club ? formatFullAddress(stop.club) : '';
          const mapsUrl = stop.club ? buildGoogleMapsUrl(stop.club) : '';
          const locationDisplay = stop.club ? stop.club.name : '';
          const hasMultipleStops = stops.length > 1;
          const isTeamTournament = !!clubName;

          // Use full address for Google Maps link text if available
          let locationLinkText = fullAddress;
          if (!locationLinkText && stop.club) {
            const streetAddress = stop.club.address1 || stop.club.address;
            const partialParts = [
              streetAddress,
              stop.club.city,
              stop.club.region,
              stop.club.postalCode
            ].filter(Boolean);

            if (partialParts.length > 0) {
              locationLinkText = `${locationDisplay}${partialParts.length > 0 ? ', ' + partialParts.join(', ') : ''}`;
            } else {
              locationLinkText = locationDisplay;
            }
          } else if (!locationLinkText) {
            locationLinkText = locationDisplay;
          }

          return `
            <div style="margin: ${index > 0 ? '30px' : '0'} 0 ${index < stops.length - 1 ? '30px' : '0'} 0;">
              <div style="margin: 4px 0; font-size: 14px; color: #374151;">
                <strong>Tournament:</strong> ${tournamentName}
              </div>
              ${hasMultipleStops ? `
                <div style="margin: 4px 0; font-size: 14px; color: #374151;">
                  <strong>Stop:</strong> ${stop.name}
                </div>
              ` : ''}
              ${isTeamTournament && clubName ? `
                <div style="margin: 4px 0; font-size: 14px; color: #374151;">
                  <strong>Team:</strong> ${clubName}
                </div>
              ` : ''}
              ${stop.bracketName ? `
                <div style="margin: 4px 0; font-size: 14px; color: #374151;">
                  <strong>Bracket:</strong> ${stop.bracketName}
                </div>
              ` : ''}
              ${locationDisplay && mapsUrl ? `
                <div style="margin: 4px 0; font-size: 14px; color: #374151;">
                  <strong>📍 Location:</strong> <a href="${mapsUrl}" style="color: #2563eb; text-decoration: none;">${locationLinkText}</a>
                </div>
              ` : locationDisplay ? `
                <div style="margin: 4px 0; font-size: 14px; color: #374151;">
                  <strong>📍 Location:</strong> ${locationDisplay}
                </div>
              ` : ''}
              <div style="margin: 4px 0; font-size: 14px; color: #374151;">
                <strong>📅 Dates:</strong> ${formatEmailDateRange(stop.startAt, stop.endAt)}
              </div>
            </div>
          `;
        }).join('')}
      </div>
    `
    : '';

  // Fallback date range for backward compatibility
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
        <title>Complete Your Payment</title>
      </head>
      <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f3f4f6;">
        <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f3f4f6; padding: 40px 20px;">
          <tr>
            <td align="center">
              <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 600px; background-color: white; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">

                <!-- Logo -->
                <tr style="background-color: #111827;">
                  <td style="padding: 30px 30px 0 30px; text-align: center;">
                    <img src="https://klyngcup.com/images/klyng-cup.png" alt="Klyng Cup" style="max-width: 150px; height: auto; margin-bottom: 20px;" />
                  </td>
                </tr>

                <!-- Header -->
                <tr>
                  <td style="background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); padding: 0px 20px 15px; text-align: center; border-radius: 0;">
                    <div style="font-size: 48px; margin-bottom: 10px;">⏰</div>
                    <h1 style="margin: 0; color: white; font-size: 28px; font-weight: 700;">Complete Your Payment</h1>
                    <p style="margin: 10px 0 0 0; color: rgba(255,255,255,0.9); font-size: 16px;">Your registration is waiting</p>
                  </td>
                </tr>

                <!-- Body -->
                <tr>
                  <td style="padding: 40px 30px;">
                    <p style="margin: 0 0 20px 0; font-size: 16px; line-height: 1.6; color: #374151;">
                      Hi <strong>${playerName}</strong>,
                    </p>

                    <p style="margin: 0 0 20px 0; font-size: 16px; line-height: 1.6; color: #374151;">
                      You've registered for <strong>${tournamentName}</strong>, but your payment is still pending.
                    </p>

                    <div style="background-color: #fef3c7; border-left: 4px solid #f59e0b; padding: 20px; margin: 20px 0; border-radius: 4px;">
                      <p style="margin: 0 0 10px 0; font-size: 14px; font-weight: 600; color: #92400e;">
                        ⚠️ Important: Complete payment within ${hoursRemaining} hours
                      </p>
                      <p style="margin: 0; font-size: 14px; color: #78350f;">
                        Your registration slot will be released if payment is not completed within ${hoursRemaining} hours.
                      </p>
                    </div>

                    <div style="background-color: #f9fafb; border: 1px solid #e5e7eb; padding: 20px; margin: 20px 0; border-radius: 4px;">
                      <div style="margin-bottom: 10px;">
                        <span style="color: #6b7280; font-size: 14px;">Tournament:</span>
                        <span style="font-weight: 600; color: #111827; margin-left: 10px;">${tournamentName}</span>
                      </div>
                      <div style="margin-bottom: 10px;">
                        <span style="color: #6b7280; font-size: 14px;">Amount Due:</span>
                        <span style="font-size: 20px; font-weight: 700; color: #111827; margin-left: 10px;">${amountFormatted}</span>
                      </div>
                      ${stopsListHtml ? '' : (dateRange !== 'Dates TBD' ? `<div style="margin-bottom: 10px;"><span style="color: #6b7280; font-size: 14px;">Dates:</span> <span style="color: #111827;">${dateRange}</span></div>` : '')}
                      ${stopsListHtml ? '' : (location ? `<div><span style="color: #6b7280; font-size: 14px;">Location:</span> <span style="color: #111827;">${location}</span></div>` : '')}
                    </div>
                    ${stopsListHtml}

                    <div style="text-align: center; margin: 30px 0;">
                      <a href="${paymentLink}" style="display: inline-block; background-color: #10b981; color: white; padding: 14px 28px; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 16px;">Complete Payment Now</a>
                    </div>

                    <p style="margin: 20px 0 0 0; font-size: 14px; line-height: 1.6; color: #6b7280;">
                      If you're having trouble completing payment, please contact our support team for assistance.
                    </p>
                  </td>
                </tr>

                <!-- Footer -->
                <tr>
                  <td style="background-color: #f9fafb; padding: 30px; text-align: center; border-radius: 0 0 8px 8px; border-top: 1px solid #e5e7eb;">
                    <p style="margin: 0 0 10px 0; font-size: 12px; color: #6b7280;">
                      See you on the court! 🏓
                    </p>
                    <p style="margin: 0; font-size: 12px; color: #6b7280;">
                      This is an automated reminder. Please do not reply.
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
    subject: `Complete Your Payment: ${tournamentName}`,
    html
  });
}

/**
 * Send waitlist confirmation email
 */
interface WaitlistConfirmationEmailParams {
  to: string;
  playerName: string;
  tournamentName: string;
  tournamentId: string;
  position: number;
  startDate?: Date | null;
  endDate?: Date | null;
  location?: string | null;
}

export async function sendWaitlistConfirmationEmail(params: WaitlistConfirmationEmailParams) {
  const {
    to,
    playerName,
    tournamentName,
    tournamentId,
    position,
    startDate,
    endDate,
    location,
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
        <title>Waitlist Confirmation</title>
      </head>
      <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f3f4f6;">
        <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f3f4f6; padding: 40px 20px;">
          <tr>
            <td align="center">
              <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 600px; background-color: white; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">

                <!-- Logo -->
                <tr style="background-color: #111827;">
                  <td style="padding: 30px 30px 0 30px; text-align: center;">
                    <img src="https://klyngcup.com/images/klyng-cup.png" alt="Klyng Cup" style="max-width: 150px; height: auto; margin-bottom: 20px;" />
                  </td>
                </tr>

                <!-- Header -->
                <tr>
                  <td style="background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); padding: 0px 20px 15px; text-align: center; border-radius: 0;">
                    <div style="font-size: 48px; margin-bottom: 10px;">📋</div>
                    <h1 style="margin: 0; color: white; font-size: 28px; font-weight: 700;">You're on the Waitlist!</h1>
                    <p style="margin: 10px 0 0 0; color: rgba(255,255,255,0.9); font-size: 16px;">Position #${position}</p>
                  </td>
                </tr>

                <!-- Body -->
                <tr>
                  <td style="padding: 40px 30px;">
                    <p style="margin: 0 0 20px 0; font-size: 16px; line-height: 1.6; color: #374151;">
                      Hi <strong>${playerName}</strong>,
                    </p>

                    <p style="margin: 0 0 20px 0; font-size: 16px; line-height: 1.6; color: #374151;">
                      You've been added to the waitlist for <strong>${tournamentName}</strong>.
                    </p>

                    <div style="background-color: #fffbeb; border-left: 4px solid #f59e0b; padding: 20px; margin: 0 0 30px 0; border-radius: 4px;">
                      <h2 style="margin: 0 0 15px 0; font-size: 22px; color: #111827;">${tournamentName}</h2>

                      <div style="margin: 10px 0; font-size: 14px; color: #374151;">
                        <strong>📋 Waitlist Position:</strong> #${position}
                      </div>

                      <div style="margin: 10px 0; font-size: 14px; color: #374151;">
                        <strong>📅 Dates:</strong> ${dateRange}
                      </div>

                      ${location ? `
                        <div style="margin: 10px 0; font-size: 14px; color: #374151;">
                          <strong>📍 Location:</strong> ${location}
                        </div>
                      ` : ''}
                    </div>

                    <div style="background-color: #f9fafb; border-radius: 4px; padding: 20px; margin: 0 0 30px 0;">
                      <h3 style="margin: 0 0 15px 0; font-size: 18px; color: #111827;">What Happens Next?</h3>
                      <ul style="margin: 0; padding-left: 20px; font-size: 14px; line-height: 1.8; color: #374151;">
                        <li>You'll receive an email notification if a spot becomes available</li>
                        <li>You'll have 24 hours to claim your spot when notified</li>
                        <li>We'll notify you in the order of your waitlist position</li>
                        <li>You can check your position anytime from your dashboard</li>
                      </ul>
                    </div>

                    <div style="background-color: #fef3c7; border-radius: 4px; padding: 15px; margin: 0 0 30px 0;">
                      <p style="margin: 0; font-size: 13px; line-height: 1.5; color: #92400e; text-align: center;">
                        ⚠️ <strong>Important:</strong> Make sure to check your email regularly. If you don't respond within 24 hours of being notified, the spot will be offered to the next person on the waitlist.
                      </p>
                    </div>

                    <div style="text-align: center; margin: 30px 0;">
                      <a href="${tournamentLink}" style="display: inline-block; background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 600;">View Scores</a>
                    </div>

                    <p style="margin: 20px 0 0 0; font-size: 14px; line-height: 1.6; color: #6b7280;">
                      We'll keep you updated on your waitlist status. Thank you for your interest in this tournament!
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
    subject: `Waitlist Confirmation: ${tournamentName} (Position #${position})`,
    html
  });
}
