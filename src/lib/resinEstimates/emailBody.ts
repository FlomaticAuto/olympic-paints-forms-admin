// Pure builders for the resin estimate email. No I/O.
import type { ResinEstimate } from './types';
import { RESIN_COMPANY } from './company';

// ─── RECIPIENT GUARD ──────────────────────────────────────────
// v1 review mode: every estimate goes to Kim only. When ready to email
// customers, return `customerEmail ? [customerEmail, ...REVIEW] : REVIEW`.
export const REVIEW_RECIPIENTS = ['kimw@olympicresins.co.za'];
export const REVIEW_MODE = true;

export function resolveRecipients(_customerEmail: string | null): string[] {
  return REVIEW_RECIPIENTS;
}

const money = (n: number) =>
  'R' + (Number(n) || 0).toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function fmtDate(iso: string | null): string {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('en-ZA', { day: '2-digit', month: 'long', year: 'numeric' });
}

export function buildDefaultBody(
  estimate: ResinEstimate, totals: { total: number },
): { subject: string; bodyText: string } {
  const subject = `Olympic Resins quote ${estimate.estimate_number} — ${estimate.client}`;
  const validLine = estimate.valid_until
    ? `This quote is valid until ${fmtDate(estimate.valid_until)}.\n\n`
    : `This quote is valid for 30 days from the date of issue.\n\n`;
  const bodyText =
    `Good day,\n\n` +
    `Thank you for the opportunity to quote. Please find Olympic Resins quote ` +
    `${estimate.estimate_number} for ${estimate.client} attached as a PDF, to the value of ` +
    `${money(totals.total)} (incl. VAT).\n\n` +
    validLine +
    `Please let me know if you have any questions.\n\n` +
    `Kind regards,\n` +
    `${estimate.prepared_by ?? RESIN_COMPANY.preparedBy}\n` +
    `${RESIN_COMPANY.name} · ${RESIN_COMPANY.phone} · ${RESIN_COMPANY.email}`;
  return { subject, bodyText };
}

// Wrap the (possibly edited) plain-text body into an email-safe HTML email.
export function bodyToHtml(bodyText: string): string {
  const escaped = bodyText
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const htmlBody = escaped.replace(/\n/g, '<br>');
  return (
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f7f6f3;padding:24px 0;">` +
    `<tr><td align="center">` +
    `<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;background:#ffffff;border-radius:6px;overflow:hidden;">` +
    `<tr><td style="background:#0D0D0B;padding:18px 28px;">` +
    `<span style="font-family:Arial,Helvetica,sans-serif;font-weight:800;font-size:18px;color:#F6C324;letter-spacing:0.03em;">OLYMPIC RESINS</span>` +
    `<span style="font-family:Arial,Helvetica,sans-serif;font-size:11px;color:#cfcfcf;display:block;margin-top:2px;">B2B Resin &amp; Solvent Supply</span>` +
    `</td></tr>` +
    `<tr><td style="padding:28px;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.6;color:#2b2b2d;">` +
    htmlBody +
    `</td></tr>` +
    `<tr><td style="background:#f7f6f3;padding:14px 28px;font-family:Arial,Helvetica,sans-serif;font-size:11px;color:#8a908e;text-align:center;">` +
    `Olympic Resins · A division of Olympic Paints · Limpopo, South Africa</td></tr>` +
    `</table></td></tr></table>`
  );
}
