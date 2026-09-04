-- Bringing the verified form maps across from the earlier permit project.
--
-- Two things happen here.
--
-- First, the Miami-Dade Universal application gets the half of itself we were
-- not filling. That form is two documents in one sheet: a building permit
-- application on top and a Notice of Commencement underneath, and the map here
-- only ever covered the top. So the app filled the application and then told
-- the contractor the NOC was missing -- from the same page it had just filled.
-- The nineteen fields added below are the NOC: the fee simple titleholder, the
-- sum, the legal description, the lender, the surety, the two dates. Section
-- numbers in the field names ("3. Name and address of fee simple titleholder")
-- are the form's own numbering, not ours.
--
-- Second, three more forms that were mapped over there and had no row here.
--
-- What is deliberately NOT brought across: every mapping onto a field that is
-- a checkbox printed as a word -- "Shingle", "Metal", "Re-Roof", "Alteration
-- Interior". They were stored as text mappings, which would write the string
-- "reroof_replacement" across the face of the form. The check boxes are handled
-- by `checks`, which resolves a work-type flag rather than a value. Also left
-- out: signature and notary fields, which stay blank on purpose, and the
-- county-assigned permit number, which is not ours to fill.

-- ---------------------------------------------------------------------------
-- 1. The NOC half of the Miami-Dade Universal application.
-- ---------------------------------------------------------------------------
--
-- Merged rather than replaced, so the checks and the existing overflow survive
-- and re-running this is harmless.
update public.permit_form_templates
set field_mapping = jsonb_set(
      jsonb_set(
        field_mapping,
        '{text}',
        coalesce(field_mapping->'text', '{}'::jsonb) || jsonb_build_object(
          -- the application, fields the old map missed
          'Address',                              'property_address',
          'Tax Folio No',                         'folio',
          -- Both of these are fifty-state option lists rather than text
          -- boxes. The filler now selects on a list when it finds one, so
          -- they set correctly; asking for a text field here is what produced
          -- "no text field State: Contractor Information" against a field
          -- that was sitting right there.
          'State: Contractor Information',        'contractor_state',
          'State: Property Owner''s Information', 'owner_state',
          -- the Notice of Commencement underneath
          '1. Legal description of property and street/address: first line', 'property_address',
          '1. description, first line',           'legal_description',
          'Metes and bounds',                     'legal_description',
          '1. Print name current owner',          'owner_name',
          '1. Print sum',                         'valuation',
          '2. Description of improvement: first line', 'scope_description',
          '2. description, first line',           'scope_description',
          '2. type date',                         'today',
          '3. Name and address of fee simple titleholder', 'owner_name',
          '3. Owner(s) name and address',         'owner_name',
          '3. description, first line',           'owner_address',
          '4. Contractor’s name, address and phone number: first line', 'contractor_company',
          '5. Name, address and phone number',    'surety_name',
          '6. Lender''s name and address',        'lender_name',
          'dated (type date)',                    'today'
        )
      ),
      '{overflow}',
      -- Not guesses. Each budget is the printed rule's own width, read off the
      -- form's widget rectangle and divided by the width of a character at the
      -- form's font size. The NOC lays its long answers across ruled lines
      -- rather than in a box, so an overflowing value continues on the line
      -- beneath rather than being clipped at the margin. The earlier map had
      -- "Description of Work" at 40 characters against a 124pt rule -- half
      -- again more than fits.
      jsonb_build_object(
        'Description of Work, line 1',
          jsonb_build_object('into', 'Description of Work, line 2', 'chars', 26),
        '1. Legal description of property and street/address: first line',
          jsonb_build_object('into', '1. second line', 'chars', 70),
        '1. description, first line',
          jsonb_build_object('into', '1. description, second line', 'chars', 49),
        '2. Description of improvement: first line',
          jsonb_build_object('into', '2. second line', 'chars', 88),
        -- Two spaces after the 4. That is how the form names it, and a
        -- single-space guess writes the overflow nowhere.
        '4. Contractor’s name, address and phone number: first line',
          jsonb_build_object('into', '4.  second line', 'chars', 71)
      )
    ),
    field_count = 202,
    requires_notary = true,
    notes = 'Application and Notice of Commencement on one sheet. Filling this fills both; the NOC still has to be signed before a notary and recorded with the Clerk before the first inspection.',
    updated_at = now()
where id = '5219251d-424a-4469-b413-b6a448691e3e';

-- ---------------------------------------------------------------------------
-- 2. Three more mapped forms.
-- ---------------------------------------------------------------------------
--
-- The form_type on each of these is deliberately NOT 'permit_application'.
-- The application finder takes the first mapped template for the county, so
-- filing a plan review request under that type would quietly hand a contractor
-- the wrong form for every Broward job.

insert into public.permit_form_templates
  (id, jurisdiction_name, county, city, form_type, form_name, file_path, field_mapping,
   fill_method, is_fillable, field_count, requires_signature, requires_notary, notes)
values
  ('5b6b1384-f18a-4968-85da-c1681590f8f7', 'Palm Beach County', 'Palm Beach', null,
   'roofing_supplement', 'Palm Beach County Expedited Re-Roof Form',
   'palm-beach-county-supplemental-1777653449655.pdf',
   '{
      "version": 1,
      "text": {
        "Address of Structure": "property_address",
        "LICENSE #": "license_number",
        "Print Name": "qualifier_name",
        "Date_af_date": "today",
        "Specify System Type Details and Pages": "scope_description"
      },
      "checks": {},
      "overflow": {}
    }'::jsonb,
   'acroform', true, 43, true, false,
   'The roof specifics on this form -- deck type, slope, squares, the product approval numbers -- are not mapped yet because the job has nowhere to keep them. They print blank and are filled by hand.'),

  ('2548343f-0a14-4d2c-b9ce-10e125a405ac', 'Broward County Building Division', 'Broward', null,
   'plan_review_request', 'BCD Enhanced Plan Review Request',
   'f0ed85aa-9abd-4070-97de-ad80d33b7c08/roofing/bcd-enhanced-plan-review-request-1770009112771.pdf',
   '{
      "version": 1,
      "text": {
        "Text1": "contractor_company",
        "Text2": "contractor_phone",
        "Text3": "contractor_email",
        "Text4": "property_address",
        "Text6": "scope_description",
        "Date7_af_date": "today",
        "Date9_af_date": "today"
      },
      "checks": {},
      "overflow": {}
    }'::jsonb,
   'acroform', true, 21, true, false,
   'Broward names this form''s fields Text1 through Text6. The map is the only record of what they mean.'),

  ('9c4658cf-a9ac-47b1-b08b-adb4f9e7ef1d', 'Broward County Building Division', 'Broward', null,
   'certificate_of_completion', 'BCD Certificate of Completion Request',
   'f0ed85aa-9abd-4070-97de-ad80d33b7c08/roofing/bcd-certificate-of-completion-request-1770009080906.pdf',
   '{
      "version": 1,
      "text": {
        "Contractor Name": "contractor_company",
        "Phone": "contractor_phone",
        "Email": "contractor_email",
        "Property Address": "property_address",
        "Property Owners Name": "owner_name",
        "Parcel IDFolio": "folio",
        "Job Value": "valuation",
        "Date1_af_date": "today"
      },
      "checks": {},
      "overflow": {}
    }'::jsonb,
   'acroform', true, 18, true, false,
   'Filed at the end of the job, not with the packet. Here so it does not have to be typed out again.')
on conflict (id) do update set
  field_mapping = excluded.field_mapping,
  form_type = excluded.form_type,
  form_name = excluded.form_name,
  file_path = excluded.file_path,
  notes = excluded.notes,
  updated_at = now();
