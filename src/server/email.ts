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
