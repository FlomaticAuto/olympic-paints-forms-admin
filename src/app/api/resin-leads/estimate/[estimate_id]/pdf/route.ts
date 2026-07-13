import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { buildPrintHtml } from '@/lib/resinEstimates/printHtml';
import { renderEstimatePdf } from '@/lib/resinEstimates/renderPdf';
import type { ResinEstimate, ResinEstimateLine } from '@/lib/resinEstimates/types';

export const runtime = 'nodejs';
export const maxDuration = 60;

// GET /api/resin-leads/estimate/[id]/pdf
// Renders the branded quote on demand and streams it INLINE so the browser
// opens it in a tab. Always reflects the latest data (no staleness), and works
// for estimates that were never sent. Add ?download=1 to force a download.
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ estimate_id: string }> },
) {
  const { estimate_id } = await params;
  const db = createServerClient();

  const { data: estRaw } = await db.from('resin_estimates').select('*').eq('id', estimate_id).maybeSingle();
  if (!estRaw) return NextResponse.json({ error: 'Estimate not found' }, { status: 404 });
  const estimate = estRaw as unknown as ResinEstimate;

  const { data: linesRaw } = await db
    .from('resin_estimate_lines').select('*').eq('estimate_id', estimate_id).order('sort_order');
  const lines = (linesRaw ?? []) as unknown as ResinEstimateLine[];
  if (lines.length === 0) {
    return NextResponse.json({ error: 'This estimate has no line items yet.' }, { status: 400 });
  }

  let pdf: Buffer;
  try {
    pdf = await renderEstimatePdf(await buildPrintHtml(estimate, lines));
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'PDF render failed';
    return NextResponse.json({ error: `Could not generate PDF: ${msg}` }, { status: 502 });
  }

  const download = req.nextUrl.searchParams.get('download') === '1';
  const disposition = download ? 'attachment' : 'inline';

  return new NextResponse(pdf as unknown as BodyInit, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `${disposition}; filename="${estimate.estimate_number}.pdf"`,
      'Cache-Control': 'no-store',
    },
  });
}
