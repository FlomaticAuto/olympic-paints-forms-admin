import { createServerClient } from '@/lib/supabase/server';
import AdminShell from '@/components/AdminShell';
import ResinCrmClient from './ResinCrmClient';
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

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Resin CRM — Olympic Paints',
};

const LEAD_COLS =
  'id,lead_ref,company,contact_person,phone,mobile,email,lead_source,lead_status,distance,street,city,province,postal_code,rep,notes,created_at';
const VISIT_COLS =
  'id,visit_ref,lead_id,lead_ref,company,rep,visit_date,distance,outcome,next_follow_up,products,total,notes,created_at';
const PRODUCT_COLS = 'id,code,name,local_price,long_price,category,is_active,sort';
const PRICE_COLS =
  'id,supplier_id,supplier_name,product_id,product_name,price,distance,lead_id,lead_ref,visit_ref,captured_at';

// Server Component — fetches directly with the service_role client.
// No API round-trip needed; middleware already guards this route.
export default async function ResinCrmPage() {
  const db = createServerClient();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const anyDb = db as any;

  const [leadsRes, visitsRes, productsRes, pricesRes] = await Promise.all([
    anyDb.from('resin_leads').select(LEAD_COLS).order('created_at', { ascending: false }),
    anyDb.from('resin_lead_visits').select(VISIT_COLS).order('visit_date', { ascending: false }),
    anyDb.from('resin_products').select(PRODUCT_COLS).order('sort'),
    anyDb.from('resin_supplier_prices').select(PRICE_COLS).order('captured_at', { ascending: true }),
  ]);

  // Track WHICH dataset failed, not just that something did — so the client
  // can tell a genuinely-empty section apart from one whose fetch broke.
  const loadErrors: string[] = [];
  if (leadsRes.error) loadErrors.push('Leads');
  if (visitsRes.error) loadErrors.push('Visits');
  if (productsRes.error) loadErrors.push('Products');
  if (pricesRes.error) loadErrors.push('Competitor Prices');
  if (loadErrors.length) {
    console.error('[admin/resin-leads]', {
      failed: loadErrors,
      errors: [leadsRes.error, visitsRes.error, productsRes.error, pricesRes.error].filter(Boolean),
    });
  }

  const leads = (leadsRes.data ?? []) as ResinLead[];
  const visits = (visitsRes.data ?? []) as ResinLeadVisit[];
  const products = (productsRes.data ?? []) as ResinProduct[];
  const prices = (pricesRes.data ?? []) as ResinSupplierPrice[];

  const competitorPricing = buildCompetitorPricing(prices, products);
  const competitorFootprint = buildCompetitorFootprint(prices, leads);
  const fieldNotes = buildFieldNotes(visits);
  const stats = buildStatTiles(leads, visits, prices);

  return (
    <AdminShell>
      <ResinCrmClient
        leads={leads}
        visits={visits}
        competitorPricing={competitorPricing}
        competitorFootprint={competitorFootprint}
        fieldNotes={fieldNotes}
        stats={stats}
        loadErrors={loadErrors}
      />
    </AdminShell>
  );
}
