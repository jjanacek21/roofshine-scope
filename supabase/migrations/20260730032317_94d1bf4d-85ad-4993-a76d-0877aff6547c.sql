CREATE TABLE public.storm_mailer_campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL,
  name text NOT NULL,
  notes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.storm_mailer_campaigns TO authenticated;
GRANT ALL ON public.storm_mailer_campaigns TO service_role;
ALTER TABLE public.storm_mailer_campaigns ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Company members manage campaigns"
  ON public.storm_mailer_campaigns FOR ALL TO authenticated
  USING (company_id = public.auth_company_id())
  WITH CHECK (company_id = public.auth_company_id());

CREATE TABLE public.storm_mailers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL,
  campaign_id uuid REFERENCES public.storm_mailer_campaigns(id) ON DELETE SET NULL,
  property_id uuid REFERENCES public.properties(id) ON DELETE SET NULL,
  address text NOT NULL,
  lat double precision NOT NULL,
  lng double precision NOT NULL,
  roof_type text,
  squares numeric,
  storm_type text CHECK (storm_type IN ('hail','wind','hurricane','tornado')),
  storm_report jsonb,
  tone text,
  prompt_input text,
  image_urls text[],
  generated_subject text,
  generated_body text,
  signature_type text CHECK (signature_type IN ('personal','company')),
  signature_payload jsonb,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','approved','exported','mailed')),
  sent_at timestamptz,
  opened_at timestamptz,
  open_count integer NOT NULL DEFAULT 0,
  clicked_at timestamptz,
  email_message_id text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX storm_mailers_company_campaign_idx ON public.storm_mailers (company_id, campaign_id);
CREATE INDEX storm_mailers_company_latlng_idx ON public.storm_mailers (company_id, lat, lng);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.storm_mailers TO authenticated;
GRANT ALL ON public.storm_mailers TO service_role;
ALTER TABLE public.storm_mailers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Company members manage mailers"
  ON public.storm_mailers FOR ALL TO authenticated
  USING (company_id = public.auth_company_id())
  WITH CHECK (company_id = public.auth_company_id());

CREATE TABLE public.owner_lookups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid,
  property_id uuid REFERENCES public.properties(id) ON DELETE CASCADE,
  provider text NOT NULL DEFAULT 'attom',
  owner_name text,
  owner_email text,
  owner_phone text,
  raw_response jsonb,
  fetched_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX owner_lookups_property_idx ON public.owner_lookups (property_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.owner_lookups TO authenticated;
GRANT ALL ON public.owner_lookups TO service_role;
ALTER TABLE public.owner_lookups ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Company members read owner lookups"
  ON public.owner_lookups FOR ALL TO authenticated
  USING (company_id IS NULL OR company_id = public.auth_company_id())
  WITH CHECK (company_id = public.auth_company_id());

CREATE TRIGGER update_storm_mailers_updated_at
  BEFORE UPDATE ON public.storm_mailers
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_storm_mailer_campaigns_updated_at
  BEFORE UPDATE ON public.storm_mailer_campaigns
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();