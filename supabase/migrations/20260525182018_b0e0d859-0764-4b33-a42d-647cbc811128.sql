
-- Switch door_knocks.disposition from enum to TEXT + CHECK so we can cover the full
-- 18-value disposition set the front-end uses, without dropping the enum elsewhere.
ALTER TABLE public.door_knocks
  ALTER COLUMN disposition TYPE text USING disposition::text;

ALTER TABLE public.door_knocks
  ADD CONSTRAINT door_knocks_disposition_check CHECK (disposition IN (
    'not_home','not_interested','go_back','interested','needs_inspection',
    'appointment_set','contract_signed','need_inspection','storm_damage',
    'unqualified','canvass_lead','new_roof','follow_up','waiting',
    'already_solar','opportunity','commercial','inspected','old_roof','won'
  ));

-- Expand property_dispositions CHECK to match.
ALTER TABLE public.property_dispositions
  DROP CONSTRAINT IF EXISTS property_dispositions_disposition_check;
ALTER TABLE public.property_dispositions
  ADD CONSTRAINT property_dispositions_disposition_check CHECK (disposition IN (
    'not_contacted','not_home','not_interested','go_back','interested','needs_inspection',
    'appointment_set','contract_signed','need_inspection','storm_damage',
    'unqualified','canvass_lead','new_roof','follow_up','waiting',
    'already_solar','opportunity','commercial','inspected','old_roof','won'
  ));
