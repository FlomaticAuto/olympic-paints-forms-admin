-- Olympic Resins — Lead capture + Lead visit log
-- Two tables: resin_leads (the lead record, created via "Capture Lead")
-- and resin_lead_visits (a visit logged against an existing lead).
-- Accessed only via service-role API routes; RLS enabled with no anon policies (PII / POPIA).

CREATE TABLE IF NOT EXISTS public.resin_leads (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_ref       text NOT NULL UNIQUE,
  company        text NOT NULL,
  contact_person text,
  phone          text,
  mobile         text,
  email          text,
  lead_source    text,
  lead_status    text NOT NULL DEFAULT 'New',
  distance       text NOT NULL DEFAULT 'Local' CHECK (distance IN ('Local','Long Distance')),
  street         text,
  city           text,
  province       text,
  postal_code    text,
  rep            text,
  notes          text,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_resin_leads_company ON public.resin_leads (company);
CREATE INDEX IF NOT EXISTS idx_resin_leads_phone   ON public.resin_leads (phone);
CREATE INDEX IF NOT EXISTS idx_resin_leads_city    ON public.resin_leads (city);
CREATE INDEX IF NOT EXISTS idx_resin_leads_status  ON public.resin_leads (lead_status);

CREATE TABLE IF NOT EXISTS public.resin_lead_visits (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  visit_ref      text NOT NULL,
  lead_id        uuid NOT NULL REFERENCES public.resin_leads(id) ON DELETE CASCADE,
  lead_ref       text NOT NULL,
  company        text NOT NULL,
  rep            text,
  visit_date     date NOT NULL,
  distance       text,                 -- snapshot of lead distance used for pricing
  outcome        text,
  next_follow_up date,
  products       jsonb DEFAULT '[]'::jsonb,  -- [{code,name,distance,unit_price,qty,line_total}]
  total          numeric(12,2),
  notes          text,
  photos         text[],               -- R2 public URLs
  created_at     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_resin_visits_lead_id    ON public.resin_lead_visits (lead_id);
CREATE INDEX IF NOT EXISTS idx_resin_visits_visit_date ON public.resin_lead_visits (visit_date);
CREATE INDEX IF NOT EXISTS idx_resin_visits_rep        ON public.resin_lead_visits (rep);

-- Keep updated_at fresh on the lead record
CREATE OR REPLACE FUNCTION public.resin_leads_touch_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_resin_leads_touch ON public.resin_leads;
CREATE TRIGGER trg_resin_leads_touch
  BEFORE UPDATE ON public.resin_leads
  FOR EACH ROW EXECUTE FUNCTION public.resin_leads_touch_updated_at();

-- RLS on, no anon/authenticated policies. Service-role API routes bypass RLS.
ALTER TABLE public.resin_leads       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.resin_lead_visits ENABLE ROW LEVEL SECURITY;
