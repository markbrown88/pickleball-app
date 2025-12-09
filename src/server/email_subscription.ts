import { sendEmail } from './email';

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://klyngcup.com';

const TEMPLATE_WRAPPER = (title: string, bodyObj: string, footerMsg: string = '') => `
<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${title}</title>
  </head>
  <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f3f4f6;">
    <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f3f4f6; padding: 40px 20px;">
      <tr>
        <td align="center">
          <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 600px; background-color: white; border-radius: 8px; box-shadow: 0 4px 6px rgba(0,0,0,0.05);">
            <!-- Header -->
            <tr>
              <td style="padding: 30px; text-align: center; border-bottom: 1px solid #f0f0f0;">
                <h2 style="color: #111827; margin: 0; font-size: 24px;">${title}</h2>
              </td>
            </tr>
            <!-- Body -->
            <tr>
              <td style="padding: 40px 30px; color: #374151; font-size: 16px; line-height: 1.6;">
                ${bodyObj}
              </td>
            </tr>
            <!-- Footer -->
            <tr>
              <td style="background-color: #f9fafb; padding: 20px; text-align: center; border-radius: 0 0 8px 8px; font-size: 12px; color: #6b7280;">
                <p>Klyng Cup Tournaments</p>
                ${footerMsg ? `<p>${footerMsg}</p>` : ''}
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>
`;

export async function sendSubscriptionSuccessEmail(to: string, clubName: string) {
    const html = TEMPLATE_WRAPPER(
        'Welcome to Klyng Cup Pro! 🚀',
        `
    <p>Hi there,</p>
    <p>Congratulations! <strong>${clubName}</strong> has been successfully upgraded to the Pro plan.</p>
    <p>You now have access to:</p>
    <ul>
      <li>Unlimited Tournaments</li>
      <li>Advanced Format Options</li>
      <li>Priority Support</li>
    </ul>
    <p>
      <a href="${BASE_URL}/admin/dashboard" style="display:inline-block; background:#2563eb; color:white; padding:12px 24px; text-decoration:none; border-radius:6px; font-weight:bold;">Go to Dashboard</a>
    </p>
    `
    );
    await sendEmail({ to, subject: 'Welcome to Klyng Cup Pro', html });
}

export async function sendPaymentSuccessEmail(to: string, clubName: string, amountCents: number, date: Date) {
    const amount = (amountCents / 100).toFixed(2);
    const dateStr = date.toLocaleDateString();
    const html = TEMPLATE_WRAPPER(
        'Payment Receipt',
        `
    <p>This is a receipt for your recent payment for <strong>${clubName}</strong>.</p>
    <div style="background:#f0fdf4; border:1px solid #bbf7d0; padding:15px; border-radius:6px; margin: 20px 0;">
      <p style="margin:5px 0;"><strong>Amount:</strong> $${amount}</p>
      <p style="margin:5px 0;"><strong>Date:</strong> ${dateStr}</p>
      <p style="margin:5px 0;"><strong>Status:</strong> Paid ✅</p>
    </div>
    <p>Thank you for your business!</p>
    `
    );
    await sendEmail({ to, subject: `Payment Receipt for ${clubName}`, html });
}

export async function sendPaymentFailedEmail(to: string, clubName: string) {
    const html = TEMPLATE_WRAPPER(
        'Payment Failed ⚠️',
        `
    <p>We were unable to process the latest subscription payment for <strong>${clubName}</strong>.</p>
    <p>Please update your payment method to avoid any service interruption.</p>
    <p>
      <a href="${BASE_URL}/admin/clubs/subscription" style="display:inline-block; background:#dc2626; color:white; padding:12px 24px; text-decoration:none; border-radius:6px; font-weight:bold;">Update Payment Method</a>
    </p>
    `
    );
    await sendEmail({ to, subject: 'Payment Action Required', html });
}

export async function sendSubscriptionCancelledEmail(to: string, clubName: string) {
    const html = TEMPLATE_WRAPPER(
        'Subscription Cancelled',
        `
    <p>The subscription for <strong>${clubName}</strong> has been cancelled.</p>
    <p>Your club has been downgraded to the Free tier. You can still access your data, but tournament creation features are now restricted.</p>
    <p>We hope to see you back soon!</p>
    <p>
      <a href="${BASE_URL}/admin/clubs/subscription" style="color:#2563eb;">Resubscribe anytime</a>
    </p>
    `
    );
    await sendEmail({ to, subject: 'Subscription Cancelled', html });
}
