-- Property type enum
CREATE TYPE public.property_type AS ENUM ('residential', 'commercial');

-- Estimate status enum
CREATE TYPE public.estimate_status AS ENUM ('draft', 'sent', 'approved', 'rejected');

-- Estimates table
CREATE TABLE public.estimates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  customer_name TEXT NOT NULL,
  customer_email TEXT,
  customer_phone TEXT,
  project_address TEXT NOT NULL,
  property_type public.property_type NOT NULL DEFAULT 'residential',
  scope_summary TEXT,
  status public.estimate_status NOT NULL DEFAULT 'draft',
  total NUMERIC(12,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_estimates_user_id ON public.estimates(user_id);
CREATE INDEX idx_estimates_status ON public.estimates(status);

ALTER TABLE public.estimates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own estimates"
  ON public.estimates FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own estimates"
  ON public.estimates FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own estimates"
  ON public.estimates FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own estimates"
  ON public.estimates FOR DELETE
  USING (auth.uid() = user_id);

-- Updated_at trigger function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_estimates_updated_at
  BEFORE UPDATE ON public.estimates
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();