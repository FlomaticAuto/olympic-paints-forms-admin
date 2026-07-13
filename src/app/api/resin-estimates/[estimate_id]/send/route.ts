import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient } from '@/lib/supabase/server';
import { resolveRecipients, REVIEW_MODE, bodyToHtml } from '@/lib/resinEstimates/emailBody';
import { buildPrintHtml } from '@/lib/resinEstimates/printHtml';
import { renderEstimatePdf } from '@/lib/resinEstimates/renderPdf';
import { sendMail } from '@/lib/mailer';
import { RESIN_COMPANY } from '@/lib/resinEstimates/company';
import type { ResinEstimate, ResinEstimateLine } from '@/lib/resinEstimates/types';

export const runtime = 'nodejs';
export const maxDuration = 60;

// Admin-cookie gate (same cookie the middleware checks for /admin pages).
async function authed(): Promise<boolean> {
  const secret = process.env.ADMIN_SECRET;
  if (!secret) return false;
  const c = await cookies();
  return c.get('oly_admin_auth')?.value === secret;
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ estimate_id: string }> },
) {
  if (!(await authed())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { estimate_id } = await params;
  const body = await req.json().catch(() => ({}));
  const subject = typeof body.subject === 'string' ? body.subject.trim() : '';
  const bodyText = typeof body.bodyText === 'string' ? body.bodyText : '';
  if (!subject || !bodyText) {
    return NextResponse.json({ error: 'subject and bodyText are required' }, { status: 400 });
  }

  const db = createServerClient();

  const { data: estRaw } = await db.from('resin_estimates').select('*').eq('id', estimate_id).maybeSingle();
  if (!estRaw) return NextResponse.json({ error: 'Estimate not found' }, { status: 404 });
  const estimate = estRaw as unknown as ResinEstimate;

  const { data: linesRaw } = await db
    .from('resin_estimate_lines').select('*').eq('estimate_id', estimate_id).order('sort_order');
  const lines = (linesRaw ?? []) as unknown as ResinEstimateLine[];
  if (lines.length === 0) {
    return NextResponse.json({ error: 'Nothing to send — this estimate has no line items.' }, { status: 400 });
  }

  // 1) Render the branded quote to PDF.
  let pdf: Buffer;
  try {
    pdf = await renderEstimatePdf(await buildPrintHtml(estimate, lines));
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'PDF render failed';
    return NextResponse.json({ error: `Could not generate PDF: ${msg}` }, { status: 502 });
  }

  const fileName = `${estimate.estimate_number}.pdf`;
  const html = bodyToHtml(bodyText);
  const recipients = resolveRecipients(estimate.contact_email);
  const subjectOut = REVIEW_MODE
    ? `${subject} [REVIEW COPY → would go to ${estimate.contact_email ?? 'no customer email'}]`
    : subject;

  // 2) Send the email with the PDF attached, from the Olympic Resins identity.
  try {
    await sendMail({
      to: recipients,
      subject: subjectOut,
      html,
      from: `"Olympic Resins" <${process.env.GMAIL_USER}>`,
      attachments: [{ filename: fileName, content: pdf }],
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Email send failed';
    return NextResponse.json({ error: msg }, { status: 502 });
  }

  // 3) Flip draft|sent → sent.
  if (estimate.status === 'draft' || estimate.status === 'sent') {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (db.from('resin_estimates') as any)
      .update({ status: 'sent', updated_at: new Date().toISOString() })
      .eq('id', estimate_id);
  }

  return NextResponse.json({ ok: true, sentTo: recipients, company: RESIN_COMPANY.name });
}
