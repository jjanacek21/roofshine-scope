
-- 1. Flag on companies
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS is_roof_king boolean NOT NULL DEFAULT false;

-- Helper: is the caller's company a Roof King company?
CREATE OR REPLACE FUNCTION public.is_roof_king_member()
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.companies c
    WHERE c.id = public.auth_company_id()
      AND c.is_roof_king = true
  );
$$;

-- 2. rk_accounts
CREATE TABLE public.rk_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  name text NOT NULL,
  primary_contact text,
  phone text,
  email text,
  city text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.rk_accounts TO authenticated;
GRANT ALL ON public.rk_accounts TO service_role;
ALTER TABLE public.rk_accounts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "rk_accounts company access" ON public.rk_accounts
  FOR ALL TO authenticated
  USING (
    public.is_super_admin()
    OR (company_id = public.auth_company_id() AND public.is_roof_king_member())
  )
  WITH CHECK (
    public.is_super_admin()
    OR (company_id = public.auth_company_id() AND public.is_roof_king_member())
  );
CREATE INDEX rk_accounts_company_idx ON public.rk_accounts(company_id);
CREATE TRIGGER rk_accounts_set_updated BEFORE UPDATE ON public.rk_accounts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 3. rk_properties
CREATE TABLE public.rk_properties (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  account_id uuid NOT NULL REFERENCES public.rk_accounts(id) ON DELETE CASCADE,
  name text NOT NULL,
  address text,
  city text,
  state text DEFAULT 'FL',
  zip text,
  roof_type text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.rk_properties TO authenticated;
GRANT ALL ON public.rk_properties TO service_role;
ALTER TABLE public.rk_properties ENABLE ROW LEVEL SECURITY;
CREATE POLICY "rk_properties company access" ON public.rk_properties
  FOR ALL TO authenticated
  USING (
    public.is_super_admin()
    OR (company_id = public.auth_company_id() AND public.is_roof_king_member())
  )
  WITH CHECK (
    public.is_super_admin()
    OR (company_id = public.auth_company_id() AND public.is_roof_king_member())
  );
CREATE INDEX rk_properties_company_idx ON public.rk_properties(company_id);
CREATE INDEX rk_properties_account_idx ON public.rk_properties(account_id);
CREATE TRIGGER rk_properties_set_updated BEFORE UPDATE ON public.rk_properties
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 4. rk_tickets
CREATE TABLE public.rk_tickets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  property_id uuid NOT NULL REFERENCES public.rk_properties(id) ON DELETE CASCADE,
  account_id uuid NOT NULL REFERENCES public.rk_accounts(id) ON DELETE CASCADE,
  wo_number integer,
  contact text,
  phone text,
  roof_type text,
  service_date date,
  status text NOT NULL DEFAULT 'new'
    CHECK (status IN ('new','dispatched','field','ready','invoiced')),
  purpose text[] NOT NULL DEFAULT '{}',
  reported_concern text,
  field_notes_raw text,
  report_polished text,
  materials jsonb NOT NULL DEFAULT '[]'::jsonb,
  labor jsonb NOT NULL DEFAULT '[]'::jsonb,
  price numeric,
  completed boolean NOT NULL DEFAULT false,
  assigned_to uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.rk_tickets TO authenticated;
GRANT ALL ON public.rk_tickets TO service_role;
ALTER TABLE public.rk_tickets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "rk_tickets company access" ON public.rk_tickets
  FOR ALL TO authenticated
  USING (
    public.is_super_admin()
    OR (company_id = public.auth_company_id() AND public.is_roof_king_member())
  )
  WITH CHECK (
    public.is_super_admin()
    OR (company_id = public.auth_company_id() AND public.is_roof_king_member())
  );
CREATE INDEX rk_tickets_company_idx ON public.rk_tickets(company_id);
CREATE INDEX rk_tickets_property_idx ON public.rk_tickets(property_id);
CREATE INDEX rk_tickets_account_idx ON public.rk_tickets(account_id);
CREATE INDEX rk_tickets_status_idx ON public.rk_tickets(status);
CREATE INDEX rk_tickets_updated_idx ON public.rk_tickets(updated_at DESC);
CREATE TRIGGER rk_tickets_set_updated BEFORE UPDATE ON public.rk_tickets
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 5. rk_form_templates
CREATE TABLE public.rk_form_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  fields jsonb NOT NULL DEFAULT '[]'::jsonb,
  is_custom boolean NOT NULL DEFAULT false,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.rk_form_templates TO authenticated;
GRANT ALL ON public.rk_form_templates TO service_role;
ALTER TABLE public.rk_form_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "rk_form_templates company access" ON public.rk_form_templates
  FOR ALL TO authenticated
  USING (
    public.is_super_admin()
    OR (company_id = public.auth_company_id() AND public.is_roof_king_member())
  )
  WITH CHECK (
    public.is_super_admin()
    OR (company_id = public.auth_company_id() AND public.is_roof_king_member())
  );
CREATE INDEX rk_form_templates_company_idx ON public.rk_form_templates(company_id);
CREATE TRIGGER rk_form_templates_set_updated BEFORE UPDATE ON public.rk_form_templates
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 6. Per-company WO sequence helper
CREATE OR REPLACE FUNCTION public.rk_next_wo(_company_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_next integer;
BEGIN
  IF NOT (public.is_super_admin()
       OR (_company_id = public.auth_company_id() AND public.is_roof_king_member())) THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;
  SELECT COALESCE(MAX(wo_number), 1000) + 1
    INTO v_next
    FROM public.rk_tickets
   WHERE company_id = _company_id;
  RETURN v_next;
END $$;

-- 7. Stamp company_id + creator on insert
CREATE OR REPLACE FUNCTION public.rk_stamp_ownership()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.company_id IS NULL THEN
    NEW.company_id := public.auth_company_id();
  END IF;
  IF TG_TABLE_NAME IN ('rk_tickets','rk_form_templates') THEN
    IF NEW.created_by IS NULL THEN
      NEW.created_by := auth.uid();
    END IF;
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER rk_accounts_stamp BEFORE INSERT ON public.rk_accounts
  FOR EACH ROW EXECUTE FUNCTION public.rk_stamp_ownership();
CREATE TRIGGER rk_properties_stamp BEFORE INSERT ON public.rk_properties
  FOR EACH ROW EXECUTE FUNCTION public.rk_stamp_ownership();
CREATE TRIGGER rk_tickets_stamp BEFORE INSERT ON public.rk_tickets
  FOR EACH ROW EXECUTE FUNCTION public.rk_stamp_ownership();
CREATE TRIGGER rk_form_templates_stamp BEFORE INSERT ON public.rk_form_templates
  FOR EACH ROW EXECUTE FUNCTION public.rk_stamp_ownership();

-- 8. Seed default templates for any company that is (or becomes) a Roof King company
INSERT INTO public.rk_form_templates (company_id, name, description, fields, is_custom)
SELECT c.id,
       'Standard Service Ticket',
       'Default service ticket capturing the essentials for every dispatch.',
       '[
         {"label":"Customer","type":"text","options":[]},
         {"label":"Property","type":"text","options":[]},
         {"label":"Service Date","type":"date","options":[]},
         {"label":"Roof Type","type":"select","options":["TPO","Modified Bitumen","Built-Up","Shingle","Metal","EPDM","Tile","Other"]},
         {"label":"Purpose","type":"select","options":["Maintenance","Warranty","Repair","Emergency"]},
         {"label":"Reported Concern","type":"textarea","options":[]},
         {"label":"Work Performed","type":"textarea","options":[]},
         {"label":"Materials Used","type":"textarea","options":[]},
         {"label":"Labor Hours","type":"number","options":[]},
         {"label":"Customer Signature Obtained","type":"checkbox","options":[]}
       ]'::jsonb,
       false
  FROM public.companies c
 WHERE c.is_roof_king = true
   AND NOT EXISTS (SELECT 1 FROM public.rk_form_templates t WHERE t.company_id = c.id AND t.name = 'Standard Service Ticket');

INSERT INTO public.rk_form_templates (company_id, name, description, fields, is_custom)
SELECT c.id,
       'Leak Inspection',
       'Targeted checklist for diagnosing roof leaks.',
       '[
         {"label":"Customer","type":"text","options":[]},
         {"label":"Property","type":"text","options":[]},
         {"label":"Leak Location (Interior)","type":"text","options":[]},
         {"label":"Active Leak?","type":"select","options":["Yes","No","Intermittent"]},
         {"label":"Suspected Source","type":"select","options":["Penetration","Seam","Flashing","Drain","Skylight","Field Membrane","Unknown"]},
         {"label":"Moisture Readings","type":"textarea","options":[]},
         {"label":"Photos Taken","type":"checkbox","options":[]},
         {"label":"Temporary Repair Performed","type":"checkbox","options":[]},
         {"label":"Recommended Permanent Repair","type":"textarea","options":[]},
         {"label":"Estimated Repair Cost","type":"number","options":[]}
       ]'::jsonb,
       false
  FROM public.companies c
 WHERE c.is_roof_king = true
   AND NOT EXISTS (SELECT 1 FROM public.rk_form_templates t WHERE t.company_id = c.id AND t.name = 'Leak Inspection');
