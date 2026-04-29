-- Tenants
CREATE TABLE public.tenants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  company_name text NOT NULL,
  company_address text,
  company_phone text,
  company_email text,
  company_web text,
  legal_addendum_url text,
  logo_base64 text,
  accent_color text NOT NULL DEFAULT '#C9A227',
  accent_color_dark text NOT NULL DEFAULT '#8F6F18',
  jurisdiction_state text NOT NULL DEFAULT 'FL',
  company_id uuid,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.tenant_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  rep_slug text NOT NULL,
  rep_name text NOT NULL,
  rep_title text,
  rep_phone text,
  rep_email text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, user_id)
);
CREATE INDEX idx_tenant_users_user ON public.tenant_users(user_id);

CREATE TABLE public.contracts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  job_id uuid REFERENCES public.jobs(id) ON DELETE SET NULL,
  document_id text NOT NULL,
  contract_type text NOT NULL CHECK (contract_type IN ('residential','insurance')),
  customer_name text,
  customer_email text,
  customer_phone text,
  property_address text,
  rep_user_id uuid REFERENCES public.tenant_users(id) ON DELETE SET NULL,
  pdf_url text,
  signed_at timestamptz,
  status text NOT NULL DEFAULT 'signed' CHECK (status IN ('pending','signed','cancelled')),
  raw_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_contracts_tenant_job ON public.contracts(tenant_id, job_id);
CREATE INDEX idx_contracts_job ON public.contracts(job_id);

-- Helper fn
CREATE OR REPLACE FUNCTION public.auth_tenant_id()
RETURNS uuid
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT tenant_id FROM public.tenant_users WHERE user_id = auth.uid() AND is_active = true LIMIT 1;
$$;

-- RLS
ALTER TABLE public.tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tenant_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contracts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members view their tenant" ON public.tenants
  FOR SELECT TO authenticated USING (id = public.auth_tenant_id());
CREATE POLICY "Super admins manage tenants" ON public.tenants
  FOR ALL TO authenticated USING (public.is_super_admin()) WITH CHECK (public.is_super_admin());

CREATE POLICY "Members view tenant users" ON public.tenant_users
  FOR SELECT TO authenticated USING (tenant_id = public.auth_tenant_id() OR user_id = auth.uid());
CREATE POLICY "Super admins manage tenant users" ON public.tenant_users
  FOR ALL TO authenticated USING (public.is_super_admin()) WITH CHECK (public.is_super_admin());

CREATE POLICY "Members view contracts" ON public.contracts
  FOR SELECT TO authenticated USING (tenant_id = public.auth_tenant_id());
CREATE POLICY "Members insert contracts" ON public.contracts
  FOR INSERT TO authenticated WITH CHECK (
    tenant_id = public.auth_tenant_id()
    AND (rep_user_id IS NULL OR EXISTS (
      SELECT 1 FROM public.tenant_users tu WHERE tu.id = rep_user_id AND tu.tenant_id = contracts.tenant_id
    ))
  );
CREATE POLICY "Members update contracts" ON public.contracts
  FOR UPDATE TO authenticated USING (tenant_id = public.auth_tenant_id());
CREATE POLICY "Super admins manage contracts" ON public.contracts
  FOR ALL TO authenticated USING (public.is_super_admin()) WITH CHECK (public.is_super_admin());

-- Storage bucket
INSERT INTO storage.buckets (id, name, public) VALUES ('contracts', 'contracts', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Public read contracts bucket" ON storage.objects
  FOR SELECT USING (bucket_id = 'contracts');

CREATE POLICY "Tenant members upload contracts" ON storage.objects
  FOR INSERT TO authenticated WITH CHECK (
    bucket_id = 'contracts'
    AND EXISTS (
      SELECT 1 FROM public.tenant_users tu
      JOIN public.tenants t ON t.id = tu.tenant_id
      WHERE tu.user_id = auth.uid() AND t.slug = (storage.foldername(name))[1]
    )
  );

CREATE POLICY "Tenant members update contracts" ON storage.objects
  FOR UPDATE TO authenticated USING (
    bucket_id = 'contracts'
    AND EXISTS (
      SELECT 1 FROM public.tenant_users tu
      JOIN public.tenants t ON t.id = tu.tenant_id
      WHERE tu.user_id = auth.uid() AND t.slug = (storage.foldername(name))[1]
    )
  );

CREATE POLICY "Tenant members delete contracts" ON storage.objects
  FOR DELETE TO authenticated USING (
    bucket_id = 'contracts'
    AND EXISTS (
      SELECT 1 FROM public.tenant_users tu
      JOIN public.tenants t ON t.id = tu.tenant_id
      WHERE tu.user_id = auth.uid() AND t.slug = (storage.foldername(name))[1]
    )
  );

-- Seed GCN tenant
INSERT INTO public.tenants (slug, company_name, company_address, company_phone, company_email, company_web, legal_addendum_url, accent_color, accent_color_dark, jurisdiction_state)
VALUES ('gcn', 'The Global Contractor Network, LLC', '233 NW 10th Street, Pompano Beach, FL 33069', '(561) 285-7866', 'jared@globalcontractor.network', 'globalcontractor.network', 'https://globalcontractor.network/legal', '#C9A227', '#8F6F18', 'FL')
ON CONFLICT (slug) DO NOTHING;

-- Seed tenant users (idempotent; only inserts if matching auth user exists)
WITH t AS (SELECT id FROM public.tenants WHERE slug = 'gcn'),
reps(rep_slug, rep_name, rep_title, rep_phone, rep_email) AS (
  VALUES
    ('jared',   'Jared Janacek',  'Owner',                        '(561) 285-7866', 'jared@globalcontractor.network'),
    ('austin',  'Austin Weiss',   'Sales & Production Director',  '(728) 213-7598', 'austin@globalcontractor.network'),
    ('aj',      'AJ Grosbeck',    'Sales Representative',         '(954) 789-0572', 'aj@globalcontractor.network'),
    ('joey',    'Joey Cowan',     'Sales Representative',         '(954) 871-7997', 'joey@globalcontractor.network'),
    ('michael', 'Michael Grosso', 'Sales Representative',         '(561) 817-0800', 'michael@globalcontractor.network')
)
INSERT INTO public.tenant_users (tenant_id, user_id, rep_slug, rep_name, rep_title, rep_phone, rep_email)
SELECT t.id, u.id, r.rep_slug, r.rep_name, r.rep_title, r.rep_phone, r.rep_email
FROM reps r
CROSS JOIN t
JOIN auth.users u ON lower(u.email) = lower(r.rep_email)
ON CONFLICT (tenant_id, user_id) DO NOTHING;