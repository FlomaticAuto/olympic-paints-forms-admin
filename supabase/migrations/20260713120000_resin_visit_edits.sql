-- Olympic Resins — allow reps to edit a logged visit and keep an audit trail.
-- 1. Track when a visit row was last changed (updated_at + touch trigger).
-- 2. resin_visit_edits: one row per edit, holding a field-level diff of what
--    changed, who changed it and when. Written by the visit PATCH API route.
-- Accessed only via service-role API routes; RLS enabled with no anon policies (PII / POPIA).

-- 1. updated_at on the visit record ------------------------------------------
ALTER TABLE public.resin_lead_visits
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

CREATE OR REPLACE FUNCTION public.resin_visits_touch_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_resin_visits_touch ON public.resin_lead_visits;
CREATE TRIGGER trg_resin_visits_touch
  BEFORE UPDATE ON public.resin_lead_visits
  FOR EACH ROW EXECUTE FUNCTION public.resin_visits_touch_updated_at();

-- 2. Change-log table --------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.resin_visit_edits (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  visit_id   uuid NOT NULL REFERENCES public.resin_lead_visits(id) ON DELETE CASCADE,
  visit_ref  text NOT NULL,
  edited_by  text,                        -- rep who made the change
  changes    jsonb NOT NULL DEFAULT '[]'::jsonb,  -- [{field,label,from,to}]
  edited_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_resin_visit_edits_visit_id ON public.resin_visit_edits (visit_id);
CREATE INDEX IF NOT EXISTS idx_resin_visit_edits_edited_at ON public.resin_visit_edits (edited_at DESC);

ALTER TABLE public.resin_visit_edits ENABLE ROW LEVEL SECURITY;
