import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { corsHeaders } from '@/lib/cors';
import { resolveRecipients, REVIEW_MODE, bodyToHtml, buildDefaultBody } from '@/lib/resinEstimates/emailBody';
import { buildPrintHtml } from '@/lib/resinEstimates/printHtml';
import { renderEstimatePdf } from '@/lib/resinEstimates/renderPdf';
import { sendMail } from '@/lib/mailer';
import type { ResinEstimate, ResinEstimateLine } from '@/lib/resinEstimates/types';

export const runtime = 'nodejs';
export const maxDuration = 60;

// Public (CORS, no auth) — same access model as the rest of /api/resin-leads.
// Renders the branded PDF and emails it to Kim (review mode).
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ estimate_id: string }> },
) {
  const origin = req.headers.get('origin');
  const { estimate_id } = await params;

  const db = createServerClient();

  const { data: estRaw } = await db.from('resin_estimates').select('*').eq('id', estimate_id).maybeSingle();
  if (!estRaw) return NextResponse.json({ error: 'Estimate not found' }, { status: 404, headers: corsHeaders(origin) });
  const estimate = estRaw as unknown as ResinEstimate;

  const { data: linesRaw } = await db
    .from('resin_estimate_lines').select('*').eq('estimate_id', estimate_id).order('sort_order');
  const lines = (linesRaw ?? []) as unknown as ResinEstimateLine[];
  if (lines.length === 0) {
    return NextResponse.json({ error: 'Nothing to send — this estimate has no line items.' }, { status: 400, headers: corsHeaders(origin) });
  }

  // Optional caller overrides; otherwise build the default subject/body.
  const body = await req.json().catch(() => ({}));
  const subtotal = lines.reduce((s, l) => s + l.unit_price * l.qty, 0);
  const total = subtotal * 1.15;
  const def = buildDefaultBody(estimate, { total });
  const subject = (typeof body.subject === 'string' && body.subject.trim()) ? body.subject.trim() : def.subject;
  const bodyText = (typeof body.bodyText === 'string' && body.bodyText.trim()) ? body.bodyText : def.bodyText;

  // 1) Render the branded quote to PDF.
  let pdf: Buffer;
  try {
    pdf = await renderEstimatePdf(await buildPrintHtml(estimate, lines));
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'PDF render failed';
    return NextResponse.json({ error: `Could not generate PDF: ${msg}` }, { status: 502, headers: corsHeaders(origin) });
  }

  const fileName = `${estimate.estimate_number}.pdf`;
  const html = bodyToHtml(bodyText);
  const recipients = resolveRecipients(estimate.contact_email);
  const subjectOut = REVIEW_MODE
    ? `${subject} [REVIEW COPY → would go to ${estimate.contact_email ?? 'no customer email'}]`
    : subject;

  // 2) Send the email with the PDF attached.
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
    return NextResponse.json({ error: msg }, { status: 502, headers: corsHeaders(origin) });
  }

  // 3) Flip draft|sent → sent.
  if (estimate.status === 'draft' || estimate.status === 'sent') {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (db.from('resin_estimates') as any)
      .update({ status: 'sent', updated_at: new Date().toISOString() })
      .eq('id', estimate_id);
  }

  return NextResponse.json({ ok: true, sentTo: recipients }, { headers: corsHeaders(origin) });
}

export async function OPTIONS(req: NextRequest) {
  return new NextResponse(null, {
    status: 204,
    headers: { ...corsHeaders(req.headers.get('origin')), 'Access-Control-Allow-Methods': 'POST, OPTIONS' },
  });
}
