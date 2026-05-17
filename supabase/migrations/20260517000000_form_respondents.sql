-- Migration: 20260517000000_form_respondents
-- Tracks expected respondents and their submission status per form.
-- Decouples respondent tracking from form answer shape in form_submissions.

CREATE TABLE IF NOT EXISTS public.form_respondents (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  form_id      uuid NOT NULL REFERENCES public.form_schemas(id) ON DELETE CASCADE,
  email        text NOT NULL,
  submitted_at timestamptz,
  created_at   timestamptz DEFAULT now(),
  UNIQUE (form_id, email)
);

ALTER TABLE public.form_respondents ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_form_respondents_form_id
  ON public.form_respondents (form_id)
  WHERE submitted_at IS NOT NULL;
