import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { corsHeaders } from '@/lib/cors';

const VISIT_COLS =
  'id,visit_ref,lead_id,lead_ref,company,rep,visit_date,distance,outcome,next_follow_up,products,total,notes,created_at,updated_at';

// GET /api/resin-leads/visit — list all visits (the "Leads Visited" view),
// each with its edit history attached as `edits` (newest first).
export async function GET(req: NextRequest) {
  const origin = req.headers.get('origin');
  const db = createServerClient();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (db as any)
    .from('resin_lead_visits')
    .select(VISIT_COLS)
    .order('visit_date', { ascending: false });

  if (error) {
    console.error('[resin-leads/visit GET]', error);
    return NextResponse.json({ error: 'Load failed' }, { status: 500, headers: corsHeaders(origin) });
  }

  const visits = (data ?? []) as Array<Record<string, unknown>>;

  // Attach edit history in one round-trip (best-effort — an edit-log failure
  // must never hide the visits themselves).
  try {
    const ids = visits.map((v) => v.id as string).filter(Boolean);
    if (ids.length) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: edits } = await (db as any)
        .from('resin_visit_edits')
        .select('id,visit_id,edited_by,changes,edited_at')
        .in('visit_id', ids)
        .order('edited_at', { ascending: false });
      const byVisit = new Map<string, unknown[]>();
      for (const e of (edits ?? []) as Array<Record<string, unknown>>) {
        const k = e.visit_id as string;
        if (!byVisit.has(k)) byVisit.set(k, []);
        byVisit.get(k)!.push(e);
      }
      for (const v of visits) v.edits = byVisit.get(v.id as string) ?? [];
    }
  } catch (e) {
    console.error('[resin-leads/visit GET] edits', e);
  }

  return NextResponse.json(visits, { headers: corsHeaders(origin) });
}

// POST /api/resin-leads/visit — log a visit against an existing lead.
// Body: { lead_id, lead_ref, company, rep, visit_date, distance, outcome,
//         next_follow_up, notes, photos: string[], products: [line...] }
// Each line: { product_id, code, name, our_price, est_qty, order_every,
//              order_unit, current_supplier, current_supplier_price, notes }
// Side effects: any new current_supplier is added to resin_suppliers, and each
// line that names a current supplier records a row in resin_supplier_prices.
export async function POST(req: NextRequest) {
  const origin = req.headers.get('origin');

  let body: Record<string, unknown>;
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400, headers: corsHeaders(origin) }); }

  const lead_id    = String(body.lead_id ?? '').trim();
  const company    = String(body.company ?? '').trim();
  const visit_date = String(body.visit_date ?? '').trim();
  if (!lead_id || !company || !visit_date) {
    return NextResponse.json({ error: 'Missing lead, company or visit date' }, { status: 400, headers: corsHeaders(origin) });
  }

  const distance = body.distance === 'Long Distance' ? 'Long Distance' : 'Local';
  const lead_ref = str(body.lead_ref) ?? '';

  const products = normalizeProducts(body.products);
  const total = productsTotal(products);
  const photos = normalizePhotos(body.photos);

  const visit_ref = genVisitRef();
  const row = {
    visit_ref, lead_id, lead_ref, company,
    rep: str(body.rep), visit_date, distance,
    outcome: str(body.outcome), next_follow_up: str(body.next_follow_up),
    products, total, notes: str(body.notes),
    photos: photos.length ? photos : null,
  };

  const db = createServerClient();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (db as any)
    .from('resin_lead_visits').insert(row).select('id,visit_ref,created_at').single();

  if (error || !data) {
    console.error('[resin-leads/visit]', error);
    return NextResponse.json({ error: 'Save failed' }, { status: 500, headers: corsHeaders(origin) });
  }

  await captureSupplierPrices(db, products, { distance, lead_id, lead_ref, visit_ref });

  // Advance the lead status to mirror the visit outcome (best-effort).
  const mapped = mapOutcomeToStatus(str(body.outcome));
  if (mapped) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (db as any).from('resin_leads').update({ lead_status: mapped }).eq('id', lead_id);
  }

  return NextResponse.json(
    { visit_id: data.id, visit_ref: data.visit_ref, total },
    { status: 201, headers: corsHeaders(origin) }
  );
}

// PATCH /api/resin-leads/visit — edit an existing visit and record a
// field-level diff of what changed into resin_visit_edits.
// Body: { id, edited_by?, visit_date, outcome, next_follow_up, notes,
//         photos: string[], products: [line...] }
export async function PATCH(req: NextRequest) {
  const origin = req.headers.get('origin');

  let body: Record<string, unknown>;
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400, headers: corsHeaders(origin) }); }

  const id = String(body.id ?? '').trim();
  const visit_date = String(body.visit_date ?? '').trim();
  if (!id || !visit_date) {
    return NextResponse.json({ error: 'Missing visit id or visit date' }, { status: 400, headers: corsHeaders(origin) });
  }

  const db = createServerClient();

  // Load the current row so we can diff against it.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: current, error: loadErr } = await (db as any)
    .from('resin_lead_visits')
    .select('id,visit_ref,lead_id,lead_ref,visit_date,distance,outcome,next_follow_up,products,total,notes,photos')
    .eq('id', id)
    .maybeSingle();

  if (loadErr || !current) {
    console.error('[resin-leads/visit PATCH] load', loadErr);
    return NextResponse.json({ error: 'Visit not found' }, { status: 404, headers: corsHeaders(origin) });
  }

  const distance = current.distance ?? 'Local'; // distance is a lead property; not edited here
  const products = normalizeProducts(body.products);
  const total = productsTotal(products);
  const photos = normalizePhotos(body.photos);

  const updated = {
    visit_date,
    outcome: str(body.outcome),
    next_follow_up: str(body.next_follow_up),
    products,
    total,
    notes: str(body.notes),
    photos: photos.length ? photos : null,
  };

  const changes = diffVisit(current, updated);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error: updErr } = await (db as any)
    .from('resin_lead_visits').update(updated).eq('id', id);

  if (updErr) {
    console.error('[resin-leads/visit PATCH] update', updErr);
    return NextResponse.json({ error: 'Save failed' }, { status: 500, headers: corsHeaders(origin) });
  }

  // Record the edit (only if something actually changed) — best-effort.
  let edit: Record<string, unknown> | null = null;
  if (changes.length) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: ins } = await (db as any).from('resin_visit_edits').insert({
        visit_id: id,
        visit_ref: current.visit_ref,
        edited_by: str(body.edited_by),
        changes,
      }).select('id,visit_id,edited_by,changes,edited_at').single();
      edit = ins ?? null;
    } catch (e) {
      console.error('[resin-leads/visit PATCH] edit-log', e);
    }
  }

  // Re-capture competitor prices from the edited line items (best-effort).
  await captureSupplierPrices(db, products, {
    distance, lead_id: current.lead_id, lead_ref: current.lead_ref, visit_ref: current.visit_ref,
  });

  // Advance the lead status to mirror the (possibly new) outcome.
  const mapped = mapOutcomeToStatus(str(body.outcome));
  if (mapped) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (db as any).from('resin_leads').update({ lead_status: mapped }).eq('id', current.lead_id);
  }

  return NextResponse.json(
    { visit_id: id, visit_ref: current.visit_ref, total, changed: changes.length, edit },
    { headers: corsHeaders(origin) }
  );
}

export async function OPTIONS(req: NextRequest) {
  return new NextResponse(null, {
    status: 204,
    headers: { ...corsHeaders(req.headers.get('origin')), 'Access-Control-Allow-Methods': 'GET, POST, PATCH, OPTIONS' },
  });
}

// ── Shared helpers ──────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function normalizeProducts(raw: unknown): Array<Record<string, any>> {
  const items = Array.isArray(raw) ? raw : [];
  return items
    .map((it) => {
      const r = it as Record<string, unknown>;
      const name = str(r.name);
      const product_id = str(r.product_id);
      if (!name && !product_id) return null;
      const our_price = num(r.our_price);
      const est_qty   = num(r.est_qty);
      return {
        product_id,
        code: str(r.code),
        name: name ?? '',
        our_price,
        est_qty,
        order_every: num(r.order_every),
        order_unit: str(r.order_unit),
        current_supplier: str(r.current_supplier),
        current_supplier_price: num(r.current_supplier_price),
        notes: str(r.notes),
        est_value: our_price != null && est_qty != null ? Math.round(our_price * est_qty * 100) / 100 : null,
      };
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    })
    .filter(Boolean) as Array<Record<string, any>>;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function productsTotal(products: Array<Record<string, any>>): number {
  return Math.round(
    products.reduce((s, p) => s + (typeof p.est_value === 'number' ? p.est_value : 0), 0) * 100
  ) / 100;
}

function normalizePhotos(raw: unknown): string[] {
  return Array.isArray(raw)
    ? (raw as unknown[]).filter((u): u is string => typeof u === 'string')
    : [];
}

// Upsert any named suppliers + record their prices. Best-effort, non-fatal.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function captureSupplierPrices(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  db: any,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  products: Array<Record<string, any>>,
  ctx: { distance: string; lead_id: string; lead_ref: string; visit_ref: string },
) {
  try {
    for (const p of products) {
      const supplier = p.current_supplier as string | null;
      if (!supplier) continue;
      const supplier_id = await upsertSupplier(db, supplier);
      await db.from('resin_supplier_prices').insert({
        supplier_id,
        supplier_name: supplier,
        product_id: (p.product_id as string) || null,
        product_name: (p.name as string) || '',
        price: p.current_supplier_price ?? null,
        distance: ctx.distance,
        lead_id: ctx.lead_id, lead_ref: ctx.lead_ref, visit_ref: ctx.visit_ref,
      });
    }
  } catch (e) {
    console.error('[resin-leads/visit] supplier capture', e);
  }
}

// Compute a human-readable field-level diff between the stored visit and the
// edited values. Only fields the edit form can change are compared.
interface Change { field: string; label: string; from: string; to: string; }
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function diffVisit(current: Record<string, any>, updated: Record<string, any>): Change[] {
  const changes: Change[] = [];
  const scalar: Array<[string, string]> = [
    ['visit_date', 'Visit Date'],
    ['outcome', 'Outcome'],
    ['next_follow_up', 'Next Follow-up'],
    ['notes', 'Notes'],
  ];
  for (const [field, label] of scalar) {
    const from = displayScalar(current[field]);
    const to = displayScalar(updated[field]);
    if (from !== to) changes.push({ field, label, from, to });
  }

  // Est. value (total) — a numeric summary of the product lines.
  const fromTotal = current.total == null ? null : Number(current.total);
  const toTotal = updated.total == null ? null : Number(updated.total);
  if ((fromTotal ?? 0) !== (toTotal ?? 0)) {
    changes.push({
      field: 'total', label: 'Est. Value',
      from: fromTotal == null ? '—' : `R${fromTotal.toFixed(2)}`,
      to: toTotal == null ? '—' : `R${toTotal.toFixed(2)}`,
    });
  }

  // Product lines — report count change and/or an edit; the full detail lives
  // in the row itself, so the log just flags that lines were touched.
  const fromProducts = Array.isArray(current.products) ? current.products : [];
  const toProducts = updated.products;
  if (JSON.stringify(stripProducts(fromProducts)) !== JSON.stringify(stripProducts(toProducts))) {
    changes.push({
      field: 'products', label: 'Products',
      from: `${fromProducts.length} line${fromProducts.length === 1 ? '' : 's'}`,
      to: `${toProducts.length} line${toProducts.length === 1 ? '' : 's'}`,
    });
  }

  // Photos — count only.
  const fromPhotos = Array.isArray(current.photos) ? current.photos : [];
  const toPhotos = Array.isArray(updated.photos) ? updated.photos : [];
  if (fromPhotos.length !== toPhotos.length) {
    changes.push({
      field: 'photos', label: 'Photos',
      from: `${fromPhotos.length}`, to: `${toPhotos.length}`,
    });
  }

  return changes;
}

// Compare only the meaningful product fields (ignore derived est_value drift).
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function stripProducts(products: Array<Record<string, any>>) {
  return (products ?? []).map((p) => ({
    product_id: p.product_id ?? null,
    name: p.name ?? '',
    our_price: p.our_price ?? null,
    est_qty: p.est_qty ?? null,
    order_every: p.order_every ?? null,
    order_unit: p.order_unit ?? null,
    current_supplier: p.current_supplier ?? null,
    current_supplier_price: p.current_supplier_price ?? null,
    notes: p.notes ?? null,
  }));
}

function displayScalar(v: unknown): string {
  if (v == null || v === '') return '—';
  return String(v);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function upsertSupplier(db: any, name: string): Promise<string | null> {
  const { data: found } = await db.from('resin_suppliers').select('id').ilike('name', name).maybeSingle();
  if (found?.id) return found.id;
  const { data: ins, error } = await db.from('resin_suppliers').insert({ name }).select('id').single();
  if (!error && ins?.id) return ins.id;
  // race on unique(lower(name)) — re-select
  const { data: again } = await db.from('resin_suppliers').select('id').ilike('name', name).maybeSingle();
  return again?.id ?? null;
}

function str(v: unknown): string | null {
  const s = typeof v === 'string' ? v.trim() : '';
  return s || null;
}
function num(v: unknown): number | null {
  if (v === '' || v === null || v === undefined) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function mapOutcomeToStatus(outcome: string | null): string | null {
  switch (outcome) {
    case 'Quoted':        return 'Quoted';
    case 'Negotiating':   return 'Negotiating';
    case 'Order Placed':
    case 'Won':           return 'Won';
    case 'Not Interested':
    case 'Lost':          return 'Lost';
    case 'Sample Requested':
    case 'Introductory Meeting':
    case 'Follow-up Required': return 'Contacted';
    default:              return null;
  }
}

function genVisitRef(): string {
  const d = new Date();
  const yy = String(d.getFullYear()).slice(2);
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const rnd = String(Math.floor(Math.random() * 9000) + 1000);
  return `RV-${yy}${mm}${dd}-${rnd}`;
}
