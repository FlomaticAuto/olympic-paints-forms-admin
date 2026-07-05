import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { corsHeaders } from '@/lib/cors';
import {
  buildCompetitorPricing,
  buildCompetitorFootprint,
  buildFieldNotes,
  buildStatTiles,
} from '@/lib/resinCrm/intelligence';
import type {
  ResinLead,
  ResinLeadVisit,
  ResinProduct,
  ResinSupplierPrice,
} from '@/lib/resinCrm/types';

const LEAD_COLS =
  'id,lead_ref,company,contact_person,phone,mobile,email,lead_source,lead_status,distance,street,city,province,postal_code,rep,notes,created_at';
const VISIT_COLS =
  'id,visit_ref,lead_id,lead_ref,company,rep,visit_date,distance,outcome,next_follow_up,products,total,notes,created_at';
const PRODUCT_COLS = 'id,code,name,local_price,long_price,category,is_active,sort';
const PRICE_COLS =
  'id,supplier_id,supplier_name,product_id,product_name,price,distance,lead_id,lead_ref,visit_ref,captured_at';

// GET /api/resin-leads/intel — the "Assessment & Intel" view: competitor
// pricing, competitor footprint, recent field notes, and stat tiles, built
// from the same resinCrm/intelligence.ts aggregation used previously.
export async function GET(req: NextRequest) {
  const origin = req.headers.get('origin');
  const db = createServerClient();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const anyDb = db as any;

  const [leadsRes, visitsRes, productsRes, pricesRes] = await Promise.all([
    anyDb.from('resin_leads').select(LEAD_COLS).order('created_at', { ascending: false }),
    anyDb.from('resin_lead_visits').select(VISIT_COLS).order('visit_date', { ascending: false }),
    anyDb.from('resin_products').select(PRODUCT_COLS).order('sort'),
    anyDb.from('resin_supplier_prices').select(PRICE_COLS).order('captured_at', { ascending: true }),
  ]);

  const loadErrors: string[] = [];
  if (leadsRes.error) loadErrors.push('Leads');
  if (visitsRes.error) loadErrors.push('Visits');
  if (productsRes.error) loadErrors.push('Products');
  if (pricesRes.error) loadErrors.push('Competitor Prices');
  if (loadErrors.length) {
    console.error('[resin-leads/intel]', {
      failed: loadErrors,
      errors: [leadsRes.error, visitsRes.error, productsRes.error, pricesRes.error].filter(Boolean),
    });
  }

  const leads = (leadsRes.data ?? []) as ResinLead[];
  const visits = (visitsRes.data ?? []) as ResinLeadVisit[];
  const products = (productsRes.data ?? []) as ResinProduct[];
  const prices = (pricesRes.data ?? []) as ResinSupplierPrice[];

  return NextResponse.json({
    competitorPricing: buildCompetitorPricing(prices, products),
    competitorFootprint: buildCompetitorFootprint(prices, leads),
    fieldNotes: buildFieldNotes(visits),
    stats: buildStatTiles(leads, visits, prices),
    loadErrors,
  }, { headers: corsHeaders(origin) });
}

export async function OPTIONS(req: NextRequest) {
  return new NextResponse(null, {
    status: 204,
    headers: { ...corsHeaders(req.headers.get('origin')), 'Access-Control-Allow-Methods': 'GET, OPTIONS' },
  });
}
