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
