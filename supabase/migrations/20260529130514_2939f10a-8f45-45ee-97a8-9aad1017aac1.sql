DELETE FROM public.property_dispositions
WHERE disposition = 'not_contacted'
  AND customer_name IS NULL
  AND customer_phone IS NULL
  AND customer_email IS NULL
  AND notes IS NULL
  AND address IS NULL;