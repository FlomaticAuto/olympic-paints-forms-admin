import nodemailer from 'nodemailer';

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_APP_PASSWORD,
  },
});

export async function sendMail(opts: {
  to: string | string[];
  subject: string;
  html: string;
  from?: string;
  attachments?: { filename: string; content: Buffer }[];
}) {
  if (!process.env.GMAIL_USER || !process.env.GMAIL_APP_PASSWORD) {
    console.warn('[mailer] GMAIL_USER or GMAIL_APP_PASSWORD not set — skipping email');
    return;
  }
  await transporter.sendMail({
    from: opts.from ?? `"HAVEN HR — Olympic Paints" <${process.env.GMAIL_USER}>`,
    to: Array.isArray(opts.to) ? opts.to.join(', ') : opts.to,
    subject: opts.subject,
    html: opts.html,
    attachments: opts.attachments,
  });
}
