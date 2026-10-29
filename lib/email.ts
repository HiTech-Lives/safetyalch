import nodemailer from 'nodemailer';

let transporter: nodemailer.Transporter | null = null;

function getTransporter(): nodemailer.Transporter {
  if (!transporter) {
    const host = process.env.SMTP_HOST || '127.0.0.1';
    const port = Number(process.env.SMTP_PORT || '25');
    const user = process.env.SMTP_USER || '';
    const pass = process.env.SMTP_PASS || '';

    transporter = nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      auth: user ? { user, pass } : undefined,
      tls: {
        rejectUnauthorized: false, // Allows local server Postfix/Plesk MTA self-signed certs
      },
    });
  }
  return transporter;
}

export async function sendMail(opts: {
  to: string | string[];
  subject: string;
  text: string;
  html?: string;
  fromName?: string;
  fromAddress?: string;
}): Promise<{ sent: boolean; error?: string }> {
  const defaultFrom = process.env.SMTP_FROM || 'The Safety Alchemist <reports@safetyalchemist.com>';
  const from =
    opts.fromName && opts.fromAddress
      ? `"${opts.fromName.replace(/"/g, '')}" <${opts.fromAddress}>`
      : defaultFrom;

  try {
    await getTransporter().sendMail({
      from,
      to: Array.isArray(opts.to) ? opts.to.join(', ') : opts.to,
      subject: opts.subject,
      text: opts.text,
      html: opts.html,
    });
    return { sent: true };
  } catch (err: any) {
    console.warn('[email] Failed to send via SMTP (' + (process.env.SMTP_HOST || '127.0.0.1') + '):', err?.message || err);
    return { sent: false, error: err?.message || String(err) };
  }
}

