ALTER TYPE public.lead_status ADD VALUE IF NOT EXISTS 'prospect';
ALTER TYPE public.lead_status ADD VALUE IF NOT EXISTS 'proposal_sent';
ALTER TYPE public.lead_status ADD VALUE IF NOT EXISTS 'nurture';