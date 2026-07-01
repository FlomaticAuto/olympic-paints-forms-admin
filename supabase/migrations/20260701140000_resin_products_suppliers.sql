-- Olympic Resins — product catalogue (editable), supplier database, and captured competitor prices.

CREATE TABLE IF NOT EXISTS public.resin_products (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code        text,
  name        text NOT NULL,
  local_price numeric(12,2),   -- NULL = no set price yet (placeholder in the form)
  long_price  numeric(12,2),
  category    text NOT NULL DEFAULT 'Resin',
  is_active   boolean NOT NULL DEFAULT true,
  sort        int NOT NULL DEFAULT 100,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_resin_products_name ON public.resin_products (lower(name));

INSERT INTO public.resin_products (code, name, local_price, long_price, category, sort) VALUES
  ('RLA001-70', 'Long Oil Alkyd',   37.84, 38.84, 'Resin', 10),
  ('RSS325-55', 'Styrenated Alkyd', 43.05, 44.05, 'Resin', 20),
  ('RMA001-55', 'Medium Oil-Soya',  40.80, 41.80, 'Resin', 30),
  (NULL, 'QD Thinners',      NULL, NULL, 'Solvent/Thinner', 40),
  (NULL, 'Lacquer Thinner',  NULL, NULL, 'Solvent/Thinner', 50),
  (NULL, '2K Thinner',       NULL, NULL, 'Solvent/Thinner', 60),
  (NULL, 'Xylene',           NULL, NULL, 'Solvent/Thinner', 70),
  (NULL, 'n Butyl Acetate',  NULL, NULL, 'Solvent/Thinner', 80),
  (NULL, 'Butyl Alcohol',    NULL, NULL, 'Solvent/Thinner', 90),
  (NULL, 'Clear Meth',       NULL, NULL, 'Solvent/Thinner', 100)
ON CONFLICT DO NOTHING;

CREATE TABLE IF NOT EXISTS public.resin_suppliers (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name       text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_resin_suppliers_name ON public.resin_suppliers (lower(name));

CREATE TABLE IF NOT EXISTS public.resin_supplier_prices (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id   uuid REFERENCES public.resin_suppliers(id) ON DELETE CASCADE,
  supplier_name text NOT NULL,
  product_id    uuid REFERENCES public.resin_products(id) ON DELETE SET NULL,
  product_name  text NOT NULL,
  price         numeric(12,2),
  distance      text,
  lead_id       uuid,
  lead_ref      text,
  visit_ref     text,
  captured_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_rsp_product  ON public.resin_supplier_prices (product_id);
CREATE INDEX IF NOT EXISTS idx_rsp_supplier ON public.resin_supplier_prices (supplier_id);

ALTER TABLE public.resin_products        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.resin_suppliers       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.resin_supplier_prices ENABLE ROW LEVEL SECURITY;
