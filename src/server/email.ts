import { Resend } from 'resend';
const resend = new Resend(process.env.RESEND_API_KEY!);

export async function sendCaptainInviteEmail(to: string, link: string) {
  if (!process.env.RESEND_API_KEY) {
    console.log('[DEV: captain invite link]', link);
    return;
  }
  await resend.emails.send({
    from: 'Tournaments <no-reply@your-domain>',
    to,
    subject: 'Your captain link',
    html: `<p>Hi Captain,</p><p>Manage your team here: <a href="${link}">${link}</a></p>`
  });
}
