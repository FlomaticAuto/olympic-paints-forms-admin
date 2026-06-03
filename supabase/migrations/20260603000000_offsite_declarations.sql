-- ============================================================
-- Olympic Paints — HAVEN Off-Site Declaration System
-- Migration: 20260603000000_offsite_declarations
-- ============================================================

-- ── 1. EMPLOYEE ROSTER CACHE ──────────────────────────────────
-- Populated by the seed script from Clocking Report YTD.xlsx.
-- Re-seeded weekly by haven_dashboard_check.py.
CREATE TABLE IF NOT EXISTS public.haven_employees (
  id           text PRIMARY KEY,            -- e.g. "EMP001", "SD012"
  full_name    text NOT NULL,
  department   text,
  employer     text NOT NULL               -- 'Olympic Paints' | 'Primeserve'
    CHECK (employer IN ('Olympic Paints', 'Primeserve')),
  active       boolean NOT NULL DEFAULT true,
  updated_at   timestamptz DEFAULT now()
);

-- ── 2. DEPARTMENT APPROVERS ───────────────────────────────────
CREATE TABLE IF NOT EXISTS public.haven_dept_approvers (
  department   text PRIMARY KEY,
  approver_name  text NOT NULL,
  approver_email text NOT NULL,
  approver_wa    text               -- WhatsApp number e.g. "27748660437"
);

-- Seed approver routing
INSERT INTO public.haven_dept_approvers (department, approver_name, approver_email, approver_wa) VALUES
  ('Merchandising', 'Quintus Lategan',  'quintusl@olympicpaints.co.za',  '27748660437'),
  ('Sales',         'Quintus Lategan',  'quintusl@olympicpaints.co.za',  '27748660437'),
  ('Delivery',      'Dispatch',         'sales@olympicpaints.co.za',     NULL),
  ('Operations',    'Dispatch',         'sales@olympicpaints.co.za',     NULL),
  ('HR',            'Accounts',         'accounts@olympicpaints.co.za',  NULL),
  ('Admin',         'Accounts',         'accounts@olympicpaints.co.za',  NULL),
  ('Primeserve',    'Accounts',         'accounts@olympicpaints.co.za',  NULL),
  ('Other',         'Quintus Lategan',  'quintusl@olympicpaints.co.za',  '27748660437')
ON CONFLICT (department) DO NOTHING;

-- ── 3. OFF-SITE DECLARATIONS ──────────────────────────────────
CREATE TABLE IF NOT EXISTS public.haven_offsite_declarations (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Employee
  employee_id      text NOT NULL,
  employee_name    text NOT NULL,
  department       text NOT NULL,
  employer         text NOT NULL,

  -- Activity
  activity_type    text NOT NULL
    CHECK (activity_type IN ('Overnight Stay','Field Visit','Delivery Run','Training','Other')),
  date_from        date NOT NULL,
  date_to          date NOT NULL,
  departure_time   time,              -- same-day trips
  return_expected  time,              -- same-day trips
  location         text NOT NULL,
  purpose          text NOT NULL,

  -- Approval
  approver_email   text NOT NULL,     -- denormalised at submit time
  approval_token   uuid NOT NULL DEFAULT gen_random_uuid(),  -- URL-safe token
  status           text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','approved','rejected','returned')),

  -- Return confirmation
  return_actual    timestamptz,

  -- Meta
  submitted_at     timestamptz DEFAULT now(),
  updated_at       timestamptz DEFAULT now()
);

-- ── 4. APPROVAL DECISIONS ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.haven_offsite_approvals (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  declaration_id   uuid NOT NULL REFERENCES public.haven_offsite_declarations(id) ON DELETE CASCADE,
  approver_name    text,
  decision         text NOT NULL CHECK (decision IN ('approved','rejected')),
  notes            text,
  decided_at       timestamptz DEFAULT now()
);

-- ── 5. RLS ────────────────────────────────────────────────────
ALTER TABLE public.haven_employees            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.haven_dept_approvers       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.haven_offsite_declarations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.haven_offsite_approvals    ENABLE ROW LEVEL SECURITY;

-- Employees: public read (needed for form dropdown), no public write
CREATE POLICY "anon_read_employees"
  ON public.haven_employees FOR SELECT TO anon USING (active = true);

-- Approvers: no public read (server-side only)

-- Declarations: anon can insert new ones; cannot read others' declarations
CREATE POLICY "anon_insert_declarations"
  ON public.haven_offsite_declarations FOR INSERT TO anon WITH CHECK (true);

-- Approvals: no public write (handled server-side via service_role)

-- ── 6. INDEXES ────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_offsite_token
  ON public.haven_offsite_declarations (approval_token);

CREATE INDEX IF NOT EXISTS idx_offsite_dates
  ON public.haven_offsite_declarations (date_from, date_to)
  WHERE status = 'approved';

CREATE INDEX IF NOT EXISTS idx_offsite_employee
  ON public.haven_offsite_declarations (employee_id, date_from DESC);

-- ── 7. UPDATED_AT TRIGGER ─────────────────────────────────────
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

CREATE TRIGGER trg_offsite_updated_at
  BEFORE UPDATE ON public.haven_offsite_declarations
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
