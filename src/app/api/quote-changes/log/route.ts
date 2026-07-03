import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { corsHeaders } from '@/lib/cors';

const EVENT_TYPES = [
  'New Quote', 'Quote Revision',
  'Price-List Change Request', 'Pricing Error / Correction',
];

// POST /api/quote-changes/log — record one quote/price-list change event.
export async function POST(req: NextRequest) {
  const origin = req.headers.get('origin');

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400, headers: corsHeaders(origin) });
  }

  const rep_code = String(body.rep_code ?? '').trim();
  if (!rep_code) {
    return NextResponse.json({ error: 'Rep is required' }, { status: 400, headers: corsHeaders(origin) });
  }
  const event_type = String(body.event_type ?? '').trim();
  if (!EVENT_TYPES.includes(event_type)) {
    return NextResponse.json({ error: 'Valid event type is required' }, { status: 400, headers: corsHeaders(origin) });
  }
  const reason_code = String(body.reason_code ?? '').trim();
  if (!reason_code) {
    return NextResponse.json({ error: 'Reason code is required' }, { status: 400, headers: corsHeaders(origin) });
  }

  const revRaw = body.revision_no;
  const revision_no =
    revRaw === '' || revRaw == null ? null : Number.isFinite(Number(revRaw)) ? Number(revRaw) : null;

  const row = {
    rep_code,
    rep_name:    str(body.rep_name),
    logged_by:   str(body.logged_by),
    event_date:  str(body.event_date) || todayISO(),
    event_type,
    account:     str(body.account),
    store_dlref: str(body.store_dlref),
    reason_code,
    revision_no,
    note:        str(body.note),
  };

  const db = createServerClient();

  // Human-friendly ref, retrying on the (rare) unique collision.
  for (let attempt = 0; attempt < 4; attempt++) {
    const entry_ref = genRef();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (db as any)
      .from('quote_change_log')
      .insert({ ...row, entry_ref })
      .select('id,entry_ref')
      .single();

    if (!error && data) {
      return NextResponse.json(
        { id: data.id, entry_ref: data.entry_ref },
        { status: 201, headers: corsHeaders(origin) }
      );
    }
    if (error && error.code !== '23505') {
      console.error('[quote-changes/log]', error);
      return NextResponse.json({ error: 'Save failed' }, { status: 500, headers: corsHeaders(origin) });
    }
  }

  return NextResponse.json({ error: 'Could not allocate an entry reference' }, { status: 500, headers: corsHeaders(origin) });
}

export async function OPTIONS(req: NextRequest) {
  return new NextResponse(null, {
    status: 204,
    headers: { ...corsHeaders(req.headers.get('origin')), 'Access-Control-Allow-Methods': 'POST, OPTIONS' },
  });
}

function str(v: unknown): string | null {
  const s = typeof v === 'string' ? v.trim() : '';
  return s || null;
}

function todayISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function genRef(): string {
  const d = new Date();
  const yy = String(d.getFullYear()).slice(2);
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const rnd = String(Math.floor(Math.random() * 9000) + 1000);
  return `QC-${yy}${mm}${dd}-${rnd}`;
}
