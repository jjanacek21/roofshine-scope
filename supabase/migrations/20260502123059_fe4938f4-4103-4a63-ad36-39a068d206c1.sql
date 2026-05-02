-- Lead status enum
DO $$ BEGIN
  CREATE TYPE public.lead_status AS ENUM ('new','contacted','qualified','quoted','won','lost');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.lead_activity_type AS ENUM ('call','email','text','note','status','ai_analysis');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ========== leads ==========
CREATE TABLE public.leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL,
  created_by UUID,
  address TEXT NOT NULL,
  city TEXT,
  state TEXT DEFAULT 'FL',
  zip TEXT,
  owner TEXT,
  sqft INTEGER,
  year_built TEXT,
  lat DOUBLE PRECISION,
  lng DOUBLE PRECISION,
  roof_type TEXT DEFAULT 'Unknown',
  property_type TEXT DEFAULT 'Commercial',
  status public.lead_status NOT NULL DEFAULT 'new',
  estimated_value NUMERIC,
  sale_amount TEXT,
  reported_owner TEXT,
  ai_report JSONB NOT NULL DEFAULT '{}'::jsonb,
  import_date TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_leads_company ON public.leads(company_id);
CREATE INDEX idx_leads_status ON public.leads(status);
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Company members view leads"
  ON public.leads FOR SELECT TO authenticated
  USING (company_id = public.auth_company_id() OR public.is_super_admin());

CREATE POLICY "Company admins insert leads"
  ON public.leads FOR INSERT TO authenticated
  WITH CHECK (company_id = public.auth_company_id() AND (public.is_company_admin() OR public.is_super_admin()));

CREATE POLICY "Company members update leads"
  ON public.leads FOR UPDATE TO authenticated
  USING (company_id = public.auth_company_id() OR public.is_super_admin());

CREATE POLICY "Company admins delete leads"
  ON public.leads FOR DELETE TO authenticated
  USING ((company_id = public.auth_company_id() AND (public.is_company_admin() OR public.is_super_admin())) OR public.is_super_admin());

CREATE TRIGGER trg_leads_updated_at BEFORE UPDATE ON public.leads
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ========== lead_contacts ==========
CREATE TABLE public.lead_contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  title TEXT,
  company TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_lead_contacts_lead ON public.lead_contacts(lead_id);
ALTER TABLE public.lead_contacts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Access lead_contacts via lead"
  ON public.lead_contacts FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.leads l WHERE l.id = lead_id AND (l.company_id = public.auth_company_id() OR public.is_super_admin())))
  WITH CHECK (EXISTS (SELECT 1 FROM public.leads l WHERE l.id = lead_id AND (l.company_id = public.auth_company_id() OR public.is_super_admin())));

-- ========== lead_contact_phones ==========
CREATE TABLE public.lead_contact_phones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id UUID NOT NULL REFERENCES public.lead_contacts(id) ON DELETE CASCADE,
  phone TEXT NOT NULL,
  phone_type TEXT NOT NULL DEFAULT 'unknown'
);
CREATE INDEX idx_lcp_contact ON public.lead_contact_phones(contact_id);
ALTER TABLE public.lead_contact_phones ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Access phones via contact->lead"
  ON public.lead_contact_phones FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.lead_contacts c
    JOIN public.leads l ON l.id = c.lead_id
    WHERE c.id = contact_id AND (l.company_id = public.auth_company_id() OR public.is_super_admin())))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.lead_contacts c
    JOIN public.leads l ON l.id = c.lead_id
    WHERE c.id = contact_id AND (l.company_id = public.auth_company_id() OR public.is_super_admin())));

-- ========== lead_contact_emails ==========
CREATE TABLE public.lead_contact_emails (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id UUID NOT NULL REFERENCES public.lead_contacts(id) ON DELETE CASCADE,
  email TEXT NOT NULL
);
CREATE INDEX idx_lce_contact ON public.lead_contact_emails(contact_id);
ALTER TABLE public.lead_contact_emails ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Access emails via contact->lead"
  ON public.lead_contact_emails FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.lead_contacts c
    JOIN public.leads l ON l.id = c.lead_id
    WHERE c.id = contact_id AND (l.company_id = public.auth_company_id() OR public.is_super_admin())))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.lead_contacts c
    JOIN public.leads l ON l.id = c.lead_id
    WHERE c.id = contact_id AND (l.company_id = public.auth_company_id() OR public.is_super_admin())));

-- ========== lead_notes ==========
CREATE TABLE public.lead_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  user_id UUID,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_lead_notes_lead ON public.lead_notes(lead_id);
ALTER TABLE public.lead_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Access notes via lead"
  ON public.lead_notes FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.leads l WHERE l.id = lead_id AND (l.company_id = public.auth_company_id() OR public.is_super_admin())))
  WITH CHECK (EXISTS (SELECT 1 FROM public.leads l WHERE l.id = lead_id AND (l.company_id = public.auth_company_id() OR public.is_super_admin())));

-- ========== lead_activities ==========
CREATE TABLE public.lead_activities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  user_id UUID,
  type public.lead_activity_type NOT NULL,
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_lead_activities_lead ON public.lead_activities(lead_id);
ALTER TABLE public.lead_activities ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Access activities via lead"
  ON public.lead_activities FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.leads l WHERE l.id = lead_id AND (l.company_id = public.auth_company_id() OR public.is_super_admin())))
  WITH CHECK (EXISTS (SELECT 1 FROM public.leads l WHERE l.id = lead_id AND (l.company_id = public.auth_company_id() OR public.is_super_admin())));

-- ========== playbook_preferences ==========
CREATE TABLE public.playbook_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE,
  selected_sections TEXT[] NOT NULL DEFAULT ARRAY['quickRef','rebuttals','masterScript']::TEXT[],
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.playbook_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage their playbook prefs"
  ON public.playbook_preferences FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE TRIGGER trg_playbook_prefs_updated_at BEFORE UPDATE ON public.playbook_preferences
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();