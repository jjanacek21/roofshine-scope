-- 1) Extend lead_status enum
ALTER TYPE public.lead_status ADD VALUE IF NOT EXISTS 'dnc';
ALTER TYPE public.lead_status ADD VALUE IF NOT EXISTS 'report_sent';

-- 2) Extend lead_activity_type enum
ALTER TYPE public.lead_activity_type ADD VALUE IF NOT EXISTS 'report_generated';
ALTER TYPE public.lead_activity_type ADD VALUE IF NOT EXISTS 'report_sent';
ALTER TYPE public.lead_activity_type ADD VALUE IF NOT EXISTS 'document_uploaded';
ALTER TYPE public.lead_activity_type ADD VALUE IF NOT EXISTS 'document_deleted';
ALTER TYPE public.lead_activity_type ADD VALUE IF NOT EXISTS 'lead_created';
ALTER TYPE public.lead_activity_type ADD VALUE IF NOT EXISTS 'lead_deleted';
ALTER TYPE public.lead_activity_type ADD VALUE IF NOT EXISTS 'geocoded';