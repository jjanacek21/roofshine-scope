-- The packet manifest: what goes in the envelope, in what order, and who signs it.
--
-- This is the piece the permit feature never had. Until now the app could tell a
-- contractor what was MISSING but had no idea what a finished packet looks like
-- -- so it stopped at a checklist and the human still had to assemble the PDF by
-- hand, in the right order, with the right cover sheet.
--
-- Each row is one jurisdiction's answer to "what does a submittable packet look
-- like here". The ordering matters: a plans examiner reads top to bottom and a
-- packet that puts the product approvals before the permit application gets
-- handed back. So does one that omits the city supplement Margate wants, or the
-- PE evaluation Boca Raton wants behind the underlayment approval.
--
-- These ten rows are not invented. They came out of the earlier expediter, where
-- they were built by reading real accepted packets from each of these counters.
-- That reading is the expensive part and it is what is being preserved here.
--
-- `source` on each document says who produces it, which is the whole contract
-- between the app and the contractor:
--   generated     -- the app draws it (cover sheet)
--   auto_fill     -- the app fills a county form from job data; human signs it
--   auto_source   -- the app pulls it from the product approval library
--   user_upload   -- only the contractor can supply it (recorded NOC, licence)
--   city_specific -- a city form a company owner has taught the app
--   conditional   -- included only when the condition fires
--
-- needs_signature / needs_notary / requires_recording are surfaced to the human,
-- never acted on. The app does not sign, notarise, or attest to anything.

create table if not exists public.permit_packet_structures (
  id uuid primary key default gen_random_uuid(),
  county text not null,
  city text,
  trade_type text not null default 'roofing',
  material_type text,
  is_hvhz boolean not null default false,
  -- The ordered manifest. Array of {order, type, source, pages, ...flags}.
  document_structure jsonb not null,
  -- Extra documents that only apply when their `condition` fires.
  conditional_documents jsonb,
  -- Who signs what, so the print-and-sign instructions are specific.
  signature_requirements jsonb,
  -- Where a recorded document has to be recorded.
  recording_requirements jsonb,
  notes text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Resolution walks from most specific to least: city+material, city, county+
-- material, county. A partial unique index per shape keeps the seed idempotent
-- and stops two rows ever answering the same lookup.
create unique index if not exists uq_packet_structure_city_material
  on public.permit_packet_structures (county, city, trade_type, material_type)
  where city is not null and material_type is not null;
create unique index if not exists uq_packet_structure_city
  on public.permit_packet_structures (county, city, trade_type)
  where city is not null and material_type is null;
create unique index if not exists uq_packet_structure_county_material
  on public.permit_packet_structures (county, trade_type, material_type)
  where city is null and material_type is not null;
create unique index if not exists uq_packet_structure_county
  on public.permit_packet_structures (county, trade_type)
  where city is null and material_type is null;

create index if not exists ix_packet_structure_lookup
  on public.permit_packet_structures (county, trade_type) where is_active;

alter table public.permit_packet_structures enable row level security;

-- Jurisdiction knowledge is shared, exactly like the product approval library.
-- One company learning that Margate wants a four-page supplement is worth
-- nothing if the next company has to learn it again. Reads are open to any
-- signed-in user; writes are staff-only for now, because a bad manifest silently
-- produces rejected packets for everyone.
drop policy if exists "packet structures readable" on public.permit_packet_structures;
create policy "packet structures readable"
  on public.permit_packet_structures for select
  to authenticated using (true);

drop policy if exists "packet structures writable by admins" on public.permit_packet_structures;
create policy "packet structures writable by admins"
  on public.permit_packet_structures for all
  to authenticated using (public.is_company_admin()) with check (public.is_company_admin());

-- ---------------------------------------------------------------------------
-- Seed. Ported verbatim from the jurisdictions already read.
-- ---------------------------------------------------------------------------

insert into public.permit_packet_structures
  (county, city, trade_type, material_type, is_hvhz, document_structure, conditional_documents, signature_requirements, recording_requirements, notes)
values
-- Broward, roofing, county default (HVHZ)
('Broward', null, 'roofing', null, true, '[
  {"order":1,"type":"cover_sheet","source":"generated","pages":1},
  {"order":2,"type":"permit_application","source":"auto_fill","pages":2,"needs_signature":true},
  {"order":3,"type":"hoa_affidavit","source":"conditional","pages":1,"condition":"if_hoa","needs_notary":true},
  {"order":4,"type":"section_1524","source":"auto_fill","pages":1,"needs_signature":true},
  {"order":5,"type":"noc","source":"auto_fill","pages":1,"needs_notary":true},
  {"order":6,"type":"owner_authorization","source":"user_upload","pages":1,"needs_signature":true},
  {"order":7,"type":"measurement_report","source":"auto_source","pages":4},
  {"order":8,"type":"product_approvals","source":"auto_source","pages":8}
]'::jsonb, null, '{"contractor":["permit_application"],"notary":["noc","hoa_affidavit"],"owner":["section_1524","noc","owner_authorization","hoa_affidavit"]}'::jsonb, null,
 'Broward county-wide roofing default. Section 1524 sits ahead of the NOC because the counter checks it first.'),

-- Broward / Margate, roofing (HVHZ) -- the city supplement is the difference
('Broward', 'Margate', 'roofing', null, true, '[
  {"order":1,"type":"cover_sheet","source":"generated","pages":1},
  {"order":2,"type":"permit_application","source":"auto_fill","pages":3,"needs_signature":true},
  {"order":3,"type":"noc","source":"auto_fill","pages":1,"needs_notary":true,"requires_recording":true},
  {"order":4,"type":"contractor_license","source":"user_upload","pages":1},
  {"order":5,"type":"coi","source":"user_upload","pages":1},
  {"order":6,"type":"roofing_material_fpa","source":"auto_source","pages":6,"product_category":"roofing"},
  {"order":7,"type":"underlayment_fpa","source":"auto_source","pages":4,"product_category":"underlayment"},
  {"order":8,"type":"hvhz_section_d","source":"auto_fill","pages":2},
  {"order":9,"type":"roof_layout","source":"user_upload","pages":2},
  {"order":10,"type":"city_supplement","source":"city_specific","pages":4,"sections":["A","B"]}
]'::jsonb, '[
  {"type":"skylight_noa","condition":"if_skylights","source":"auto_source","pages":4},
  {"type":"change_of_plan","condition":"if_change_of_plan","source":"user_upload"}
]'::jsonb, '{"noc":"owner_and_contractor","permit_application":"contractor"}'::jsonb, null,
 'Margate wants the four-page city supplement last and will hand the packet back without it.'),

-- Broward, windows and doors (HVHZ)
('Broward', null, 'windows_doors', null, true, '[
  {"order":1,"type":"cover_sheet","source":"generated","pages":1},
  {"order":2,"type":"permit_application","source":"auto_fill","pages":2,"needs_signature":true},
  {"order":3,"type":"noc","source":"auto_fill","pages":2,"needs_notary":true,"requires_recording":true},
  {"order":4,"type":"owner_authorization","source":"user_upload","needs_signature":true},
  {"order":5,"type":"hoa_affidavit","source":"conditional","condition":"if_hoa","needs_notary":true},
  {"order":6,"type":"energy_calculations","source":"auto_fill","pages":1},
  {"order":7,"type":"product_approvals","source":"auto_source","product_category":"Impact Window"},
  {"order":8,"type":"product_approvals","source":"auto_source","product_category":"Impact Door"},
  {"order":9,"type":"coi","source":"user_upload"},
  {"order":10,"type":"contractor_license","source":"user_upload"}
]'::jsonb, null, null, null, null),

-- Miami-Dade, metal roofing (HVHZ)
('Miami-Dade', null, 'roofing', 'metal', true, '[
  {"order":1,"type":"cover_sheet","source":"generated","pages":1},
  {"order":2,"type":"permit_application","source":"auto_fill","pages":2,"needs_signature":true,"needs_notary":true},
  {"order":3,"type":"owner_notification","source":"auto_fill","pages":1,"needs_signature":true},
  {"order":4,"type":"hvhz_section_d","source":"auto_fill","pages":2},
  {"order":5,"type":"roof_to_wall_affidavit","source":"conditional","pages":1,"condition":"if_pre_1994_or_over_300k","needs_notary":true},
  {"order":6,"type":"underlayment_fpa","source":"auto_source","pages":6,"product_category":"underlayment","include_guidelines":true},
  {"order":7,"type":"roofing_material_fpa","source":"auto_source","pages":8,"product_category":"metal_roofing","include_installation_guide":true}
]'::jsonb, null, '{"contractor":["permit_application","hvhz_section_d"],"notary":["permit_application","roof_to_wall_affidavit"],"owner":["owner_notification"]}'::jsonb, null,
 'The roof-to-wall affidavit is the owner''s sworn statement. The app assembles it blank and never ticks it.'),

-- Miami-Dade, windows and doors (HVHZ)
('Miami-Dade', null, 'windows_doors', null, true, '[
  {"order":1,"type":"cover_sheet","source":"generated","pages":1},
  {"order":2,"type":"permit_application","source":"auto_fill","pages":2,"needs_signature":true},
  {"order":3,"type":"noc","source":"auto_fill","pages":2,"needs_notary":true,"requires_recording":true},
  {"order":4,"type":"owner_authorization","source":"user_upload","needs_signature":true},
  {"order":5,"type":"energy_calculations","source":"auto_fill","pages":1},
  {"order":6,"type":"product_approvals","source":"auto_source","product_category":"Impact Window"},
  {"order":7,"type":"product_approvals","source":"auto_source","product_category":"Impact Door"},
  {"order":8,"type":"engineering_drawings","source":"conditional","condition":"if_over_30ft_or_multifamily"},
  {"order":9,"type":"coi","source":"user_upload"},
  {"order":10,"type":"contractor_license","source":"user_upload"}
]'::jsonb, null, null, null, null),

-- Palm Beach / Boca Raton, metal roofing
('Palm Beach', 'Boca Raton', 'roofing', 'metal', false, '[
  {"order":1,"type":"cover_sheet","source":"generated","pages":1},
  {"order":2,"type":"permit_application","source":"auto_fill","pages":2,"needs_signature":true},
  {"order":3,"type":"noc","source":"auto_fill","pages":1,"needs_notary":true,"requires_recording":true},
  {"order":4,"type":"city_supplement","source":"city_specific","pages":6,"sections":["A","B","C"],"needs_notary":true},
  {"order":5,"type":"underlayment_fpa","source":"auto_source","pages":4,"product_category":"underlayment"},
  {"order":6,"type":"underlayment_pe_evaluation","source":"auto_source","pages":8,"include_full_report":true},
  {"order":7,"type":"compliance_statement","source":"auto_fill","pages":2,"include_pe_seal":true},
  {"order":8,"type":"roofing_material_fpa","source":"auto_source","pages":6,"product_category":"metal_roofing"},
  {"order":9,"type":"fastening_patterns","source":"auto_fill","pages":4},
  {"order":10,"type":"impact_test_report","source":"auto_source","pages":4,"test_type":"UL_2218"},
  {"order":11,"type":"roof_to_wall_mitigation","source":"conditional","pages":2,"condition":"if_pre_1988_and_over_300k","needs_notary":true}
]'::jsonb, null, '{"notary":["noc","city_supplement","roof_to_wall_mitigation"],"owner":["noc","city_supplement"],"qualifier":["permit_application","city_supplement"]}'::jsonb, '{"noc":"Palm Beach County Clerk of Court"}'::jsonb,
 'Fastening patterns are reproduced from the approval''s own detail pages. Nothing here is computed.'),

-- Palm Beach / Wellington, metal roofing
('Palm Beach', 'Wellington', 'roofing', 'metal', false, '[
  {"order":1,"type":"cover_sheet","source":"generated","pages":1},
  {"order":2,"type":"property_appraiser_summary","source":"auto_source","pages":2},
  {"order":3,"type":"permit_application","source":"auto_fill","pages":2,"needs_signature":true},
  {"order":4,"type":"roof_to_wall_mitigation","source":"generated","pages":1,"needs_notary":true},
  {"order":5,"type":"contractor_license","source":"user_upload","pages":1},
  {"order":6,"type":"underlayment_fpa","source":"auto_source","pages":4,"product_category":"underlayment"},
  {"order":7,"type":"underlayment_pe_evaluation","source":"auto_source","pages":8,"include_full_report":true},
  {"order":8,"type":"roofing_material_fpa","source":"auto_source","pages":6,"product_category":"metal_roofing"},
  {"order":9,"type":"roof_layout","source":"user_upload","pages":2},
  {"order":10,"type":"form_300_metal","source":"auto_fill","pages":2,"needs_signature":true},
  {"order":11,"type":"underlayment_options","source":"auto_fill","pages":1}
]'::jsonb, '[
  {"type":"skylight_noa","condition":"if_skylights","source":"auto_source"},
  {"type":"hoa_affidavit","condition":"if_hoa","source":"user_upload","needs_notary":true}
]'::jsonb, '{"noc":"owner_and_contractor","permit_application":"contractor","roof_to_wall_mitigation":"contractor_notarized"}'::jsonb, null,
 'Wellington opens with the property appraiser summary -- it is how they confirm the parcel before reading anything else.'),

-- Palm Beach, shingle roofing (county default)
('Palm Beach', null, 'roofing', 'shingle', false, '[
  {"order":1,"type":"cover_sheet","source":"generated","pages":1},
  {"order":2,"type":"property_appraiser_summary","source":"auto_source","pages":2},
  {"order":3,"type":"permit_application","source":"auto_fill","pages":2,"needs_signature":true},
  {"order":4,"type":"noc","source":"auto_fill","pages":1,"needs_notary":true,"requires_recording":true},
  {"order":5,"type":"contractor_license","source":"user_upload","pages":1},
  {"order":6,"type":"coi","source":"user_upload","pages":1},
  {"order":7,"type":"underlayment_fpa","source":"auto_source","pages":4,"product_category":"underlayment"},
  {"order":8,"type":"underlayment_pe_evaluation","source":"auto_source","pages":8,"include_full_report":true},
  {"order":9,"type":"roofing_material_fpa","source":"auto_source","pages":6,"product_category":"shingle"},
  {"order":10,"type":"roof_layout","source":"user_upload","pages":2},
  {"order":11,"type":"form_100_shingle","source":"auto_fill","pages":2,"needs_signature":true},
  {"order":12,"type":"underlayment_options","source":"auto_fill","pages":1},
  {"order":13,"type":"roof_to_wall_mitigation","source":"conditional","pages":1,"condition":"if_pre_1994","needs_notary":true}
]'::jsonb, '[{"type":"skylight_noa","condition":"if_skylights","source":"auto_source"}]'::jsonb,
 '{"form_100_shingle":"contractor","noc":"owner_and_contractor","permit_application":"contractor"}'::jsonb, null, null),

-- Palm Beach, roofing (county default, no material)
('Palm Beach', null, 'roofing', null, false, '[
  {"order":1,"type":"cover_sheet","source":"generated","pages":1},
  {"order":2,"type":"permit_application","source":"auto_fill","pages":2,"needs_signature":true},
  {"order":3,"type":"noc","source":"auto_fill","pages":1,"needs_notary":true,"requires_recording":true},
  {"order":4,"type":"owner_authorization","source":"user_upload","pages":1,"needs_signature":true},
  {"order":5,"type":"signed_contract","source":"auto_source","pages":2},
  {"order":6,"type":"contractor_license","source":"user_upload","pages":1},
  {"order":7,"type":"coi","source":"user_upload","pages":1},
  {"order":8,"type":"product_approvals","source":"auto_source","pages":8},
  {"order":9,"type":"roof_layout","source":"auto_source","pages":2}
]'::jsonb, null, '{"contractor":["permit_application"],"notary":["noc"],"owner":["noc","owner_authorization"]}'::jsonb, '{"noc":"Palm Beach County Clerk of Court"}'::jsonb, null),

-- Palm Beach, windows and doors
('Palm Beach', null, 'windows_doors', null, false, '[
  {"order":1,"type":"cover_sheet","source":"generated","pages":1},
  {"order":2,"type":"permit_application","source":"auto_fill","pages":2,"needs_signature":true},
  {"order":3,"type":"noc","source":"auto_fill","pages":2,"needs_notary":true,"requires_recording":true},
  {"order":4,"type":"owner_authorization","source":"user_upload","needs_signature":true},
  {"order":5,"type":"energy_calculations","source":"auto_fill","pages":1},
  {"order":6,"type":"product_approvals","source":"auto_source","product_category":"Impact Window"},
  {"order":7,"type":"product_approvals","source":"auto_source","product_category":"Impact Door"},
  {"order":8,"type":"coi","source":"user_upload"},
  {"order":9,"type":"contractor_license","source":"user_upload"}
]'::jsonb, null, null, null, null)
on conflict do nothing;
