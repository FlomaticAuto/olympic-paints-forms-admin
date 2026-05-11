-- ============================================================
-- Olympic Paints — Dynamic Form Management System
-- Migration: 20260511000000_form_system
-- ============================================================

-- ── 1. EXTENSIONS ────────────────────────────────────────────
-- pg_cron is pre-installed on Supabase; just enable it.
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- ── 2. TABLES ─────────────────────────────────────────────────

-- form_schemas: stores form definitions as JSON schemas
CREATE TABLE IF NOT EXISTS public.form_schemas (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title        text NOT NULL,
  description  text,
  schema       jsonb NOT NULL,          -- array of field objects
  created_by   text,
  active_from  timestamptz NOT NULL DEFAULT now(),
  active_until timestamptz,             -- null = never expires
  is_archived  boolean NOT NULL DEFAULT false,
  created_at   timestamptz DEFAULT now()
);

-- form_submissions: stores responses keyed to a form
CREATE TABLE IF NOT EXISTS public.form_submissions (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  form_id       uuid REFERENCES public.form_schemas(id) ON DELETE CASCADE,
  submitted_by  text,                   -- populated from name field if present
  data          jsonb NOT NULL,         -- full field responses
  submitted_at  timestamptz DEFAULT now(),
  metadata      jsonb                   -- user_agent, submitted_at echo, etc.
);

-- ── 3. ROW LEVEL SECURITY ─────────────────────────────────────

ALTER TABLE public.form_schemas    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.form_submissions ENABLE ROW LEVEL SECURITY;

-- Public (anon): read active, non-archived forms only
CREATE POLICY "anon_read_active_forms"
  ON public.form_schemas
  FOR SELECT
  TO anon
  USING (
    is_archived = false
    AND (active_until IS NULL OR active_until > now())
  );

-- Public (anon): insert submissions only — no read, no update, no delete
CREATE POLICY "anon_insert_submissions"
  ON public.form_submissions
  FOR INSERT
  TO anon
  WITH CHECK (true);

-- service_role bypasses RLS by default — no extra policies needed.
-- Authenticated users (admin app) also use service_role client server-side.

-- ── 4. AUTO-ARCHIVE FUNCTION ──────────────────────────────────

CREATE OR REPLACE FUNCTION public.archive_expired_forms()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
AS $$
  UPDATE public.form_schemas
  SET is_archived = true
  WHERE active_until < now()
    AND is_archived = false;
$$;

-- ── 5. PG_CRON JOB — run daily at 00:00 UTC ───────────────────
-- Requires the pg_cron extension and that Supabase has granted
-- cron.schedule permission (available on Pro plans and above).
-- On free tier: call POST /api/forms/run-archive manually or via
-- an external cron (e.g. GitHub Actions schedule).

SELECT cron.schedule(
  'archive-expired-forms',            -- job name (must be unique)
  '0 0 * * *',                        -- cron expression: midnight UTC daily
  $$SELECT public.archive_expired_forms();$$
);

-- ── 6. HELPER INDEX ───────────────────────────────────────────
-- Speeds up the RLS policy check for the anon form fetch.
CREATE INDEX IF NOT EXISTS idx_form_schemas_active
  ON public.form_schemas (is_archived, active_until)
  WHERE is_archived = false;

-- Speeds up per-form submission lookups in the admin.
CREATE INDEX IF NOT EXISTS idx_submissions_form_id
  ON public.form_submissions (form_id, submitted_at DESC);
