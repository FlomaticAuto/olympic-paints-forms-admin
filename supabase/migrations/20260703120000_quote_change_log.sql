-- Quote & Price-List Change Tracker
-- A rework / exception log: sales admin logs one row every time a rep triggers
-- admin work (new quote, quote revision, price-list change request, pricing error).
-- Reason codes make the churn Pareto-analysable ("62% of rework = rep changed price").
-- Accessed only via service-role API routes; RLS enabled, no anon policies.

CREATE TABLE IF NOT EXISTS public.quote_change_log (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entry_ref      text NOT NULL UNIQUE,
  rep_code       text NOT NULL,          -- AC/AP/BV/BM/NP
  rep_name       text,                   -- full name snapshot for reporting
  logged_by      text,                   -- which sales admin captured this
  event_date     date NOT NULL,
  event_type     text NOT NULL CHECK (event_type IN (
                     'New Quote', 'Quote Revision',
                     'Price-List Change Request', 'Pricing Error / Correction')),
  account        text,                   -- customer / account name (free text)
  reason_code    text NOT NULL,
  revision_no    integer,                -- how many times THIS quote has now been redone
  note           text,
  created_at     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_qcl_rep_code    ON public.quote_change_log (rep_code);
CREATE INDEX IF NOT EXISTS idx_qcl_event_date  ON public.quote_change_log (event_date);
CREATE INDEX IF NOT EXISTS idx_qcl_event_type  ON public.quote_change_log (event_type);
CREATE INDEX IF NOT EXISTS idx_qcl_reason_code ON public.quote_change_log (reason_code);

ALTER TABLE public.quote_change_log ENABLE ROW LEVEL SECURITY;
-- No anon policies: all access is via service-role API routes.
