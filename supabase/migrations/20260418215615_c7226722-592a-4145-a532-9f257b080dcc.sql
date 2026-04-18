
-- =============================================================
-- ENUMS
-- =============================================================
CREATE TYPE public.app_role AS ENUM ('owner', 'admin', 'estimator', 'member');
CREATE TYPE public.trade_type AS ENUM ('roofing', 'exterior', 'windows', 'interior', 'hvac', 'plumbing', 'electrical', 'mitigation');
CREATE TYPE public.job_status AS ENUM ('lead', 'inspected', 'estimated', 'proposed', 'signed', 'in_progress', 'complete');
CREATE TYPE public.estimate_doc_status AS ENUM ('draft', 'sent', 'approved', 'rejected');
CREATE TYPE public.catalog_status AS ENUM ('active', 'inactive');
CREATE TYPE public.price_book_status AS ENUM ('active', 'archived');

-- =============================================================
-- COMPANIES
-- =============================================================
CREATE TABLE public.companies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  logo_url TEXT,
  address TEXT,
  phone TEXT,
  email TEXT,
  website TEXT,
  trades trade_type[] NOT NULL DEFAULT '{}',
  default_tax_rate NUMERIC(5,2) NOT NULL DEFAULT 0,
  default_markup NUMERIC(5,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =============================================================
-- PROFILES (extends auth.users)
-- =============================================================
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  company_id UUID REFERENCES public.companies(id) ON DELETE SET NULL,
  first_name TEXT,
  last_name TEXT,
  email TEXT,
  phone TEXT,
  role app_role NOT NULL DEFAULT 'member',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =============================================================
-- HELPER FUNCTIONS (security definer to avoid RLS recursion)
-- =============================================================
CREATE OR REPLACE FUNCTION public.auth_company_id()
RETURNS UUID
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT company_id FROM public.profiles WHERE id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.profiles WHERE id = _user_id AND role = _role);
$$;

CREATE OR REPLACE FUNCTION public.is_company_admin()
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role IN ('owner', 'admin')
  );
$$;

-- =============================================================
-- CLIENTS
-- =============================================================
CREATE TABLE public.clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  address TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_clients_company ON public.clients(company_id);

-- =============================================================
-- JOBS
-- =============================================================
CREATE TABLE public.jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  client_id UUID REFERENCES public.clients(id) ON DELETE SET NULL,
  job_number TEXT,
  name TEXT NOT NULL,
  property_address TEXT,
  status job_status NOT NULL DEFAULT 'lead',
  primary_trade trade_type,
  total_estimate NUMERIC(12,2) NOT NULL DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_jobs_company ON public.jobs(company_id);
CREATE INDEX idx_jobs_status ON public.jobs(company_id, status);

-- =============================================================
-- LINE ITEM MASTER (catalog)
-- =============================================================
CREATE TABLE public.line_item_master (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  trade trade_type NOT NULL,
  category TEXT,
  unit TEXT NOT NULL DEFAULT 'EA',
  waste_pct NUMERIC(5,2) NOT NULL DEFAULT 0,
  default_price NUMERIC(12,2) NOT NULL DEFAULT 0,
  status catalog_status NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_lim_company ON public.line_item_master(company_id);
CREATE INDEX idx_lim_trade ON public.line_item_master(company_id, trade);

-- =============================================================
-- PRICE BOOKS
-- =============================================================
CREATE TABLE public.price_books (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  source TEXT,
  region TEXT,
  status price_book_status NOT NULL DEFAULT 'active',
  item_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_pb_company ON public.price_books(company_id);

-- =============================================================
-- ESTIMATES (drop the old single-user table, recreate)
-- =============================================================
DROP TABLE IF EXISTS public.estimates CASCADE;

CREATE TABLE public.estimates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  job_id UUID NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  status estimate_doc_status NOT NULL DEFAULT 'draft',
  subtotal NUMERIC(12,2) NOT NULL DEFAULT 0,
  tax NUMERIC(12,2) NOT NULL DEFAULT 0,
  total NUMERIC(12,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_estimates_company ON public.estimates(company_id);
CREATE INDEX idx_estimates_job ON public.estimates(job_id);

-- =============================================================
-- ESTIMATE LINE ITEMS
-- =============================================================
CREATE TABLE public.estimate_line_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  estimate_id UUID NOT NULL REFERENCES public.estimates(id) ON DELETE CASCADE,
  line_item_id UUID REFERENCES public.line_item_master(id) ON DELETE SET NULL,
  trade trade_type NOT NULL,
  code TEXT,
  name TEXT NOT NULL,
  unit TEXT NOT NULL DEFAULT 'EA',
  qty NUMERIC(12,3) NOT NULL DEFAULT 1,
  unit_price NUMERIC(12,2) NOT NULL DEFAULT 0,
  total NUMERIC(12,2) NOT NULL DEFAULT 0,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_eli_estimate ON public.estimate_line_items(estimate_id);

-- =============================================================
-- TIMESTAMP TRIGGER (reuse existing public.update_updated_at_column)
-- =============================================================
CREATE TRIGGER trg_companies_updated BEFORE UPDATE ON public.companies
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_profiles_updated BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_clients_updated BEFORE UPDATE ON public.clients
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_jobs_updated BEFORE UPDATE ON public.jobs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_lim_updated BEFORE UPDATE ON public.line_item_master
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_pb_updated BEFORE UPDATE ON public.price_books
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_estimates_updated BEFORE UPDATE ON public.estimates
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =============================================================
-- AUTO-CREATE PROFILE ON SIGNUP
-- =============================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, first_name, last_name)
  VALUES (
    NEW.id,
    NEW.email,
    NEW.raw_user_meta_data ->> 'first_name',
    NEW.raw_user_meta_data ->> 'last_name'
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- =============================================================
-- ENABLE RLS
-- =============================================================
ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.line_item_master ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.price_books ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.estimates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.estimate_line_items ENABLE ROW LEVEL SECURITY;

-- =============================================================
-- RLS POLICIES — COMPANIES
-- =============================================================
CREATE POLICY "Members view their company" ON public.companies
  FOR SELECT TO authenticated USING (id = public.auth_company_id());

CREATE POLICY "Authenticated can create a company" ON public.companies
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Admins update their company" ON public.companies
  FOR UPDATE TO authenticated USING (id = public.auth_company_id() AND public.is_company_admin());

-- =============================================================
-- RLS POLICIES — PROFILES
-- =============================================================
CREATE POLICY "View profiles in same company" ON public.profiles
  FOR SELECT TO authenticated
  USING (id = auth.uid() OR company_id = public.auth_company_id());

CREATE POLICY "Update own profile" ON public.profiles
  FOR UPDATE TO authenticated USING (id = auth.uid());

-- =============================================================
-- GENERIC COMPANY-SCOPED POLICIES
-- =============================================================
-- CLIENTS
CREATE POLICY "Company members view clients" ON public.clients
  FOR SELECT TO authenticated USING (company_id = public.auth_company_id());
CREATE POLICY "Company members insert clients" ON public.clients
  FOR INSERT TO authenticated WITH CHECK (company_id = public.auth_company_id());
CREATE POLICY "Company members update clients" ON public.clients
  FOR UPDATE TO authenticated USING (company_id = public.auth_company_id());
CREATE POLICY "Company members delete clients" ON public.clients
  FOR DELETE TO authenticated USING (company_id = public.auth_company_id());

-- JOBS
CREATE POLICY "Company members view jobs" ON public.jobs
  FOR SELECT TO authenticated USING (company_id = public.auth_company_id());
CREATE POLICY "Company members insert jobs" ON public.jobs
  FOR INSERT TO authenticated WITH CHECK (company_id = public.auth_company_id());
CREATE POLICY "Company members update jobs" ON public.jobs
  FOR UPDATE TO authenticated USING (company_id = public.auth_company_id());
CREATE POLICY "Company members delete jobs" ON public.jobs
  FOR DELETE TO authenticated USING (company_id = public.auth_company_id());

-- LINE ITEM MASTER
CREATE POLICY "Company members view catalog" ON public.line_item_master
  FOR SELECT TO authenticated USING (company_id = public.auth_company_id());
CREATE POLICY "Company members insert catalog" ON public.line_item_master
  FOR INSERT TO authenticated WITH CHECK (company_id = public.auth_company_id());
CREATE POLICY "Company members update catalog" ON public.line_item_master
  FOR UPDATE TO authenticated USING (company_id = public.auth_company_id());
CREATE POLICY "Company members delete catalog" ON public.line_item_master
  FOR DELETE TO authenticated USING (company_id = public.auth_company_id());

-- PRICE BOOKS
CREATE POLICY "Company members view price books" ON public.price_books
  FOR SELECT TO authenticated USING (company_id = public.auth_company_id());
CREATE POLICY "Company members insert price books" ON public.price_books
  FOR INSERT TO authenticated WITH CHECK (company_id = public.auth_company_id());
CREATE POLICY "Company members update price books" ON public.price_books
  FOR UPDATE TO authenticated USING (company_id = public.auth_company_id());
CREATE POLICY "Company members delete price books" ON public.price_books
  FOR DELETE TO authenticated USING (company_id = public.auth_company_id());

-- ESTIMATES
CREATE POLICY "Company members view estimates" ON public.estimates
  FOR SELECT TO authenticated USING (company_id = public.auth_company_id());
CREATE POLICY "Company members insert estimates" ON public.estimates
  FOR INSERT TO authenticated WITH CHECK (company_id = public.auth_company_id());
CREATE POLICY "Company members update estimates" ON public.estimates
  FOR UPDATE TO authenticated USING (company_id = public.auth_company_id());
CREATE POLICY "Company members delete estimates" ON public.estimates
  FOR DELETE TO authenticated USING (company_id = public.auth_company_id());

-- ESTIMATE LINE ITEMS (joined via estimate)
CREATE POLICY "View estimate line items" ON public.estimate_line_items
  FOR SELECT TO authenticated USING (
    EXISTS (SELECT 1 FROM public.estimates e WHERE e.id = estimate_id AND e.company_id = public.auth_company_id())
  );
CREATE POLICY "Insert estimate line items" ON public.estimate_line_items
  FOR INSERT TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM public.estimates e WHERE e.id = estimate_id AND e.company_id = public.auth_company_id())
  );
CREATE POLICY "Update estimate line items" ON public.estimate_line_items
  FOR UPDATE TO authenticated USING (
    EXISTS (SELECT 1 FROM public.estimates e WHERE e.id = estimate_id AND e.company_id = public.auth_company_id())
  );
CREATE POLICY "Delete estimate line items" ON public.estimate_line_items
  FOR DELETE TO authenticated USING (
    EXISTS (SELECT 1 FROM public.estimates e WHERE e.id = estimate_id AND e.company_id = public.auth_company_id())
  );
