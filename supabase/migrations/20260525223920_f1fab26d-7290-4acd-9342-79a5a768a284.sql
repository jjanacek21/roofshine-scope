
UPDATE public.property_dispositions
   SET lat_lng_hash = ('0_' || id::text)
 WHERE lat_lng_hash IS NULL;

ALTER TABLE public.property_dispositions
  ALTER COLUMN lat_lng_hash SET NOT NULL;
