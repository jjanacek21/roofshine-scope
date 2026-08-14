DROP INDEX IF EXISTS public.roof_corrections_property_structure_key;
CREATE UNIQUE INDEX roof_corrections_property_structure_key
  ON public.roof_corrections (property_id, structure_key);