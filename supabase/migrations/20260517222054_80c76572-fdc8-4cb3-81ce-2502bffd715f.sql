ALTER TYPE public.roof_edge_type ADD VALUE IF NOT EXISTS 'unlabeled';
ALTER TYPE public.roof_edge_type ADD VALUE IF NOT EXISTS 'parapet_wall';
ALTER TYPE public.roof_edge_type ADD VALUE IF NOT EXISTS 'drip_edge';

ALTER TABLE public.roof_lines
  ADD COLUMN IF NOT EXISTS is_perimeter boolean NOT NULL DEFAULT false;

ALTER TABLE public.roof_measurements
  ADD COLUMN IF NOT EXISTS parapet_wall_lf numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS drip_edge_lf numeric NOT NULL DEFAULT 0;