
CREATE TABLE public.material_suppliers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE,
  name text NOT NULL,
  rep_name text, rep_phone text, rep_email text,
  branch text,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.material_suppliers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "view suppliers" ON public.material_suppliers FOR SELECT
  USING (company_id IS NULL OR company_id = public.auth_company_id());
CREATE POLICY "admin manage suppliers" ON public.material_suppliers FOR ALL
  USING (company_id = public.auth_company_id() AND public.is_company_admin())
  WITH CHECK (company_id = public.auth_company_id() AND public.is_company_admin());
CREATE TRIGGER trg_material_suppliers_updated BEFORE UPDATE ON public.material_suppliers
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.material_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE,
  slug text NOT NULL,
  label text NOT NULL,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE NULLS NOT DISTINCT (company_id, slug)
);
ALTER TABLE public.material_categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "view categories" ON public.material_categories FOR SELECT
  USING (company_id IS NULL OR company_id = public.auth_company_id());
CREATE POLICY "admin manage categories" ON public.material_categories FOR ALL
  USING (company_id = public.auth_company_id() AND public.is_company_admin())
  WITH CHECK (company_id = public.auth_company_id() AND public.is_company_admin());

CREATE TABLE public.material_catalog (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE,
  supplier_id uuid REFERENCES public.material_suppliers(id) ON DELETE SET NULL,
  category_id uuid NOT NULL REFERENCES public.material_categories(id) ON DELETE CASCADE,
  slug text,
  brand text,
  name text NOT NULL,
  uom text NOT NULL,
  unit_price numeric(10,2) NOT NULL DEFAULT 0,
  coverage jsonb,
  effective_date date,
  active boolean NOT NULL DEFAULT true,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_material_catalog_lookup ON public.material_catalog(company_id, category_id, active);
CREATE INDEX idx_material_catalog_slug ON public.material_catalog(slug);
ALTER TABLE public.material_catalog ENABLE ROW LEVEL SECURITY;
CREATE POLICY "view catalog" ON public.material_catalog FOR SELECT
  USING (company_id IS NULL OR company_id = public.auth_company_id());
CREATE POLICY "admin manage catalog" ON public.material_catalog FOR ALL
  USING (company_id = public.auth_company_id() AND public.is_company_admin())
  WITH CHECK (company_id = public.auth_company_id() AND public.is_company_admin());
CREATE TRIGGER trg_material_catalog_updated BEFORE UPDATE ON public.material_catalog
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.roof_system_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE,
  slug text NOT NULL,
  label text NOT NULL,
  icon text,
  inputs jsonb NOT NULL DEFAULT '[]'::jsonb,
  sort_order int NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE NULLS NOT DISTINCT (company_id, slug)
);
ALTER TABLE public.roof_system_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "view templates" ON public.roof_system_templates FOR SELECT
  USING (company_id IS NULL OR company_id = public.auth_company_id());
CREATE POLICY "admin manage templates" ON public.roof_system_templates FOR ALL
  USING (company_id = public.auth_company_id() AND public.is_company_admin())
  WITH CHECK (company_id = public.auth_company_id() AND public.is_company_admin());
CREATE TRIGGER trg_roof_system_templates_updated BEFORE UPDATE ON public.roof_system_templates
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.template_material_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id uuid NOT NULL REFERENCES public.roof_system_templates(id) ON DELETE CASCADE,
  label text NOT NULL,
  default_material_id uuid REFERENCES public.material_catalog(id) ON DELETE SET NULL,
  formula jsonb NOT NULL DEFAULT '{}'::jsonb,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_tml_template ON public.template_material_lines(template_id, sort_order);
ALTER TABLE public.template_material_lines ENABLE ROW LEVEL SECURITY;
CREATE POLICY "view template lines" ON public.template_material_lines FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.roof_system_templates t WHERE t.id = template_id
    AND (t.company_id IS NULL OR t.company_id = public.auth_company_id()))
);
CREATE POLICY "admin manage template lines" ON public.template_material_lines FOR ALL USING (
  EXISTS (SELECT 1 FROM public.roof_system_templates t WHERE t.id = template_id
    AND t.company_id = public.auth_company_id()) AND public.is_company_admin()
) WITH CHECK (
  EXISTS (SELECT 1 FROM public.roof_system_templates t WHERE t.id = template_id
    AND t.company_id = public.auth_company_id()) AND public.is_company_admin()
);

CREATE TABLE public.template_labor_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id uuid NOT NULL REFERENCES public.roof_system_templates(id) ON DELETE CASCADE,
  task text NOT NULL,
  uom text NOT NULL,
  rate numeric(10,2) NOT NULL DEFAULT 0,
  formula jsonb NOT NULL DEFAULT '{}'::jsonb,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_tll_template ON public.template_labor_lines(template_id, sort_order);
ALTER TABLE public.template_labor_lines ENABLE ROW LEVEL SECURITY;
CREATE POLICY "view labor lines" ON public.template_labor_lines FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.roof_system_templates t WHERE t.id = template_id
    AND (t.company_id IS NULL OR t.company_id = public.auth_company_id()))
);
CREATE POLICY "admin manage labor lines" ON public.template_labor_lines FOR ALL USING (
  EXISTS (SELECT 1 FROM public.roof_system_templates t WHERE t.id = template_id
    AND t.company_id = public.auth_company_id()) AND public.is_company_admin()
) WITH CHECK (
  EXISTS (SELECT 1 FROM public.roof_system_templates t WHERE t.id = template_id
    AND t.company_id = public.auth_company_id()) AND public.is_company_admin()
);

CREATE TABLE public.job_order_drafts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
  company_id uuid NOT NULL,
  template_id uuid REFERENCES public.roof_system_templates(id) ON DELETE SET NULL,
  inputs jsonb NOT NULL DEFAULT '{}'::jsonb,
  material_overrides jsonb NOT NULL DEFAULT '[]'::jsonb,
  labor_overrides jsonb NOT NULL DEFAULT '[]'::jsonb,
  markup_pct numeric(5,2) NOT NULL DEFAULT 35,
  sales_tax_pct numeric(5,2) NOT NULL DEFAULT 7,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(job_id)
);
ALTER TABLE public.job_order_drafts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "company member view drafts" ON public.job_order_drafts FOR SELECT
  USING (company_id = public.auth_company_id());
CREATE POLICY "company member manage drafts" ON public.job_order_drafts FOR ALL
  USING (company_id = public.auth_company_id())
  WITH CHECK (company_id = public.auth_company_id());
CREATE TRIGGER trg_job_order_drafts_updated BEFORE UPDATE ON public.job_order_drafts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.job_order_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
  company_id uuid NOT NULL,
  snapshot_date timestamptz NOT NULL DEFAULT now(),
  template_label text,
  inputs jsonb NOT NULL DEFAULT '{}'::jsonb,
  materials jsonb NOT NULL DEFAULT '[]'::jsonb,
  labor jsonb NOT NULL DEFAULT '[]'::jsonb,
  totals jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_job_snapshots_job ON public.job_order_snapshots(job_id, snapshot_date DESC);
ALTER TABLE public.job_order_snapshots ENABLE ROW LEVEL SECURITY;
CREATE POLICY "company view snapshots" ON public.job_order_snapshots FOR SELECT
  USING (company_id = public.auth_company_id());
CREATE POLICY "company create snapshots" ON public.job_order_snapshots FOR INSERT
  WITH CHECK (company_id = public.auth_company_id());

-- ============================================================
-- SEED DATA
-- ============================================================

INSERT INTO public.material_suppliers (company_id, name, rep_name, rep_phone, rep_email, branch)
VALUES (NULL, 'SRS Distribution', 'Hunter Prussel', '321-624-4885', 'hunter.prussel@srsbuildingproducts.com', 'Pompano Beach');

INSERT INTO public.material_categories (company_id, slug, label, sort_order) VALUES
  (NULL, 'shingles', 'Field Shingles', 10),
  (NULL, 'hip_ridge', 'Hip & Ridge Cap', 20),
  (NULL, 'starter', 'Starter Course', 30),
  (NULL, 'underlayment_mech', 'Underlayment (Mech)', 40),
  (NULL, 'underlayment_sa', 'Underlayment (Self-Adhered)', 50),
  (NULL, 'low_slope', 'Low-Slope / Flat Membrane', 60),
  (NULL, 'tile', 'Concrete Tile', 70),
  (NULL, 'metal', 'Metal / Flashings', 80),
  (NULL, 'ventilation', 'Ventilation', 90),
  (NULL, 'pipe_flashing', 'Pipe Flashings / Boots', 100),
  (NULL, 'fasteners', 'Fasteners / Nails', 110),
  (NULL, 'adhesives', 'Adhesives / Caulks', 120),
  (NULL, 'skylights', 'Skylights', 130),
  (NULL, 'wood', 'Wood / Decking', 140),
  (NULL, 'gutters', 'Gutters', 150),
  (NULL, 'delivery', 'Delivery / Fuel', 160);

DO $seed$
DECLARE
  v_supplier uuid;
BEGIN
  SELECT id INTO v_supplier FROM public.material_suppliers WHERE company_id IS NULL AND name = 'SRS Distribution' LIMIT 1;

  INSERT INTO public.material_catalog (company_id, supplier_id, category_id, slug, name, uom, unit_price)
  SELECT NULL, v_supplier, c.id, x.slug, x.name, x.uom, x.unit_price
  FROM public.material_categories c
  JOIN (VALUES
    ('shingles','sh_gaf_hdz','GAF Timberline HDZ','SQ',117.00),
    ('shingles','sh_gaf_uhdz','GAF Timberline Ultra HDZ','SQ',135.00),
    ('shingles','sh_oc_oak','Owens Corning Oakridge','SQ',113.00),
    ('shingles','sh_oc_dur','Owens Corning Duration','SQ',118.00),
    ('shingles','sh_ct_lm','Certainteed Landmark','SQ',118.00),
    ('shingles','sh_ct_lmpro','Certainteed Landmark Pro','SQ',135.00),
    ('shingles','sh_iko_camb','IKO Cambridge','SQ',107.00),
    ('shingles','sh_iko_dyn','IKO Dynasty','SQ',112.00),
    ('shingles','sh_tamko_her','TAMKO Heritage','SQ',110.00),
    ('shingles','sh_tamko_titan','TAMKO Titan XT','SQ',118.00),
    ('hip_ridge','hr_gaf_sar','GAF S-A-R Hip & Ridge','BD',63.00),
    ('hip_ridge','hr_gaf_tt','GAF Timbertex Hip & Ridge','BD',78.00),
    ('hip_ridge','hr_oc_pe','OC ProEdge Hip & Ridge','BD',76.50),
    ('hip_ridge','hr_ct_sh','Certainteed Shadow Hip & Ridge','BD',68.00),
    ('hip_ridge','hr_iko','IKO Hip & Ridge','BD',78.00),
    ('hip_ridge','hr_tamko','TAMKO Hip & Ridge','BD',69.00),
    ('starter','st_gaf_ps','GAF Pro-Start Starter','BD',56.00),
    ('starter','st_oc','OC Starter Strip Plus','BD',55.00),
    ('starter','st_ct','Certainteed SwiftStart','BD',59.00),
    ('starter','st_iko','IKO Starter','BD',55.00),
    ('starter','st_tamko','Tamko Starter','BD',58.00),
    ('starter','st_ts','Top Shield Starter','BD',48.00),
    ('underlayment_mech','ul_sg','Stormgear (Top Shield)','RL',70.00),
    ('underlayment_mech','ul_sg30','SG 30 (Top Shield)','RL',80.50),
    ('underlayment_mech','ul_ts20','TS-20 (Top Shield)','RL',62.00),
    ('underlayment_mech','ul_gaf_fb','GAF Feltbuster','RL',101.00),
    ('underlayment_mech','ul_ct_rr','CT RoofRunner','RL',97.00),
    ('underlayment_mech','ul_titanium','Titanium UDL / RhinoRoof U20','RL',77.50),
    ('underlayment_mech','ul_atlas','Atlas Summit 60','RL',78.00),
    ('underlayment_mech','ul_poly_anchor','Polyglass PolyAnchor HV Base','RL',108.00),
    ('underlayment_sa','sa_cmi','CMI SecureGrip','RL',68.50),
    ('underlayment_sa','sa_resisto','Resisto LB1236 / TS Defender','RL',67.50),
    ('underlayment_sa','sa_msa','MSA Quik-Stick','RL',68.50),
    ('underlayment_sa','sa_poly_irxe','Polyglass IR-XE','RL',79.50),
    ('underlayment_sa','sa_titanium_psu','Titanium PSU-30 Hi-Temp','RL',116.00),
    ('underlayment_sa','sa_gaf_ww','GAF WeatherWatch','RL',94.50),
    ('underlayment_sa','sa_gaf_sg','GAF StormGuard','RL',108.00),
    ('underlayment_sa','sa_ct_dry','CT DryRoof','RL',90.00),
    ('underlayment_sa','sa_ct_wg','CT WinterGuard X','RL',83.00),
    ('underlayment_sa','sa_iko_ss','IKO StormShield','RL',99.00),
    ('underlayment_sa','sa_poly_tup','Polyglass TU-Plus Hi-Temp','RL',132.00),
    ('underlayment_sa','sa_poly_tumax','Polyglass TU-Max Hi-Temp','RL',119.00),
    ('low_slope','ls_ct_pb','Certainteed Flintlastic Plybase (SA)','RL',118.00),
    ('low_slope','ls_ct_cap','Certainteed Flintlastic CAP (SA)','RL',118.00),
    ('low_slope','ls_ct_gta','Certainteed Flintlastic GTA (Torch)','RL',97.35),
    ('low_slope','ls_poly_eb','Polyglass Elastobase SA','RL',113.00),
    ('low_slope','ls_poly_ef','Polyglass Elastoflex SA-V Base','RL',132.00),
    ('low_slope','ls_poly_pf','Polyglass Polyflex SA-P CAP','RL',117.00),
    ('low_slope','ls_poly_pg','Polyglass Polyflex G (Torch)','RL',101.00),
    ('low_slope','ls_gaf_lib_b','GAF Liberty SA Base','RL',142.00),
    ('low_slope','ls_gaf_lib_c','GAF Liberty SA Cap','RL',142.00),
    ('low_slope','ls_oc_ds_b','OC DeckSeal SA Base','RL',143.00),
    ('low_slope','ls_oc_ds_c','OC DeckSeal SA Cap','RL',143.00),
    ('tile','tile_eagle','Eagle Concrete Tile','SQ',120.00),
    ('tile','tile_westlake','Westlake Tile','SQ',120.00),
    ('tile','tile_crown','Crown Tile','SQ',120.00),
    ('tile','tile_trim_eagle','Eagle Hip/Ridge Trim Tile','PC',3.72),
    ('tile','tile_trim_wl','Westlake Hip/Ridge Trim Tile','PC',3.72),
    ('tile','tile_oxide','Oxide Color','BAG',32.00),
    ('tile','tile_mortar','Roof Tile Mortar','BAG',10.00),
    ('tile','tile_bond','Tile Bond Kit (23 lb)','EA',240.00),
    ('metal','mt_de','Drip Edge 26GA 2.5" Painted','PC',10.50),
    ('metal','mt_lf','L-Flashing 26GA 4"x5"','PC',13.00),
    ('metal','mt_cf','Counter Flashing 26GA 3"','PC',17.95),
    ('metal','mt_vr','Valley Roll 26GA 16"x50''','RL',77.00),
    ('metal','mt_bird','Tile Eave Closure (Birdstop)','PC',14.00),
    ('metal','mt_tv','Tile W Valley Preformed 26GA','PC',62.50),
    ('metal','mt_pan','Tile Pan-Flashing 26GA','PC',27.50),
    ('metal','mt_hr_ch','Tile Preformed Hip/Ridge Channel','RL',28.75),
    ('ventilation','v_gaf_cobra','GAF Cobra Ridge Vent 12"','PC',13.65),
    ('ventilation','v_oc_vs','OC VentSure Ridge Vent 12"','PC',13.65),
    ('ventilation','v_ct_sov','Certainteed Ridge Vent 12"','PC',12.50),
    ('ventilation','v_atlas_tr','Atlas TruRidge Vent 12"','PC',14.65),
    ('ventilation','v_ts_omni','Top Shield Omni Ridge Vent','PC',12.40),
    ('ventilation','v_lomanco','LoMANCO LO Omni Roll','RL',109.00),
    ('ventilation','v_gn4','Gooseneck w/ Damper 4" Painted','EA',43.75),
    ('ventilation','v_gn10','Gooseneck w/ Damper 10" Painted','EA',48.00),
    ('ventilation','v_orv','Off-Ridge Vent 4'' Painted','EA',82.50),
    ('ventilation','v_750','LoMANCO 750 Vent','EA',37.25),
    ('ventilation','v_770','LoMANCO 770 Vent','EA',52.00),
    ('ventilation','v_tile_gn4','Tile Gooseneck 4" Mill','EA',55.50),
    ('ventilation','v_tile_orv','Tile Off-Ridge Vent 4'' Mill','EA',128.00),
    ('ventilation','v_ohagin','O''Hagin Tile Vent','EA',68.50),
    ('pipe_flashing','pf_esb','Electrical Split Boot','EA',33.25),
    ('pipe_flashing','pf_lb15','Lead Boot 1.5"','EA',12.35),
    ('pipe_flashing','pf_lb2','Lead Boot 2"','EA',13.15),
    ('pipe_flashing','pf_lb3','Lead Boot 3"','EA',17.10),
    ('pipe_flashing','pf_lb4','Lead Boot 4"','EA',23.90),
    ('pipe_flashing','pf_bb15','Bullet Boot 1.5"','EA',16.80),
    ('pipe_flashing','pf_bb2','Bullet Boot 2"','EA',17.10),
    ('pipe_flashing','pf_bb3','Bullet Boot 3"','EA',20.75),
    ('pipe_flashing','pf_bb4','Bullet Boot 4"','EA',39.25),
    ('pipe_flashing','pf_tlb15','Tile Lead Boot 1.5"','EA',33.50),
    ('pipe_flashing','pf_tlb2','Tile Lead Boot 2"','EA',36.75),
    ('pipe_flashing','pf_tlb3','Tile Lead Boot 3"','EA',40.25),
    ('pipe_flashing','pf_tlb4','Tile Lead Boot 4"','EA',45.75),
    ('fasteners','f_pcn','1" Plastic Cap Nails (3000/pail)','Pail',21.00),
    ('fasteners','f_mcn','1" Metal Cap Nails (25#)','Pail',87.50),
    ('fasteners','f_8d','2-3/8" 8D BRT RS Coil Nails','BOX',46.00),
    ('fasteners','f_125','1-1/4" Coil Nails','BOX',38.00),
    ('fasteners','f_stinger','Stinger 1" Cap Nail Pack','BOX',52.00),
    ('fasteners','f_quik','Quickdrive 2.5" Tile Fastener Galv','BOX',112.00),
    ('adhesives','a_pg400','PG400 Polyglass Adhesive 5gal','BKT',42.50),
    ('adhesives','a_k13','Karnak #13 5gal','BKT',43.05),
    ('adhesives','a_pg500','PG500 Modified 5gal','BKT',48.25),
    ('adhesives','a_k19','Karnak #19 Ultra 5gal','BKT',66.00),
    ('adhesives','a_prime','Asphalt Spray Primer 14oz','Can',11.25),
    ('adhesives','a_spray','Spray Paint 12oz','Can',15.00),
    ('adhesives','a_np1','NP1 Caulking 10oz','EA',11.05),
    ('adhesives','a_geo','Geocell 2300 Caulk 10oz','EA',9.85),
    ('adhesives','a_tspu','Top Shield Polyurethane 10oz','EA',12.60),
    ('adhesives','a_titebond','Titebond Tile Caulking 9.5oz','EA',12.35),
    ('skylights','sk_22sfg','Kennedy 2222 SFG 2"x2" Curb','EA',242.67),
    ('skylights','sk_46sfg','Kennedy 2246 SFG 2"x4" Curb','EA',316.87),
    ('skylights','sk_22cmg','Kennedy 2222 CMG Curb Mount','EA',180.22),
    ('skylights','sk_46cmg','Kennedy 2246 CMG Curb Mount','EA',251.25),
    ('wood','w_batten','Wood Batten 1"x2"x4''','BD',11.68),
    ('wood','w_cdx','1/2" CDX Plywood 4''x8''','EA',31.50),
    ('wood','w_waka11','Wakaflex 11" Wall Flashing 33''','Roll',273.00),
    ('wood','w_waka22','Wakaflex 22" Wall Flashing 16.5''','Roll',366.00),
    ('gutters','g_6al','6" Seamless Aluminum Gutter','LF',4.85),
    ('gutters','g_dspout','3"x4" Downspout (10'')','EA',24.00),
    ('gutters','g_corner','Inside/Outside Corner','EA',18.00),
    ('gutters','g_endcap','End Cap (L/R)','EA',6.50),
    ('gutters','g_hanger','Hidden Hangers','EA',2.25),
    ('gutters','g_screw','Gutter Screws (box)','BOX',22.00),
    ('delivery','d_local','Local Delivery Charge','Delivery',95.00),
    ('delivery','d_fuel','Temporary Fuel Surcharge','Delivery',60.00)
  ) AS x(cat_slug, slug, name, uom, unit_price) ON x.cat_slug = c.slug
  WHERE c.company_id IS NULL;
END $seed$;

DO $tpl$
DECLARE
  t_id uuid;
BEGIN
  -- SHINGLE
  INSERT INTO public.roof_system_templates (company_id, slug, label, icon, inputs, sort_order)
  VALUES (NULL, 'shingle', 'Shingle Roof', 'Layers',
    '["sq","hip_ridge_lf","eave_rake_lf","valley_lf","pipes","vents","ridge_vent_lf","deck_sheets"]'::jsonb, 10)
  RETURNING id INTO t_id;
  INSERT INTO public.template_material_lines (template_id, label, default_material_id, formula, sort_order)
  SELECT t_id, x.label, (SELECT id FROM public.material_catalog WHERE company_id IS NULL AND slug = x.mat_slug), x.formula::jsonb, x.sort_order
  FROM (VALUES
    ('Field Shingle','sh_gaf_hdz','{"base":"sq","waste_pct":10}',10),
    ('Hip & Ridge Cap','hr_gaf_sar','{"base":"hip_ridge_lf","divide_by":25,"waste_pct":5}',20),
    ('Starter','st_gaf_ps','{"base":"eave_rake_lf","divide_by":120,"waste_pct":5}',30),
    ('Synthetic Underlayment','ul_titanium','{"base":"sq","divide_by":10,"waste_pct":10}',40),
    ('Peel & Stick (eaves/valleys)','sa_poly_irxe','{"base":"eave_rake_lf","divide_by":50,"min":2}',50),
    ('Drip Edge','mt_de','{"base":"eave_rake_lf","divide_by":10,"waste_pct":5}',60),
    ('Valley Metal','mt_vr','{"base":"valley_lf","divide_by":50,"min":1}',70),
    ('Wall / Step Flashing','mt_lf','{"base":"sq","divide_by":10,"min":2}',80),
    ('Pipe Flashing (2")','pf_lb2','{"base":"pipes"}',90),
    ('Exhaust Vent','v_750','{"base":"vents"}',100),
    ('Ridge Vent','v_gaf_cobra','{"base":"ridge_vent_lf","divide_by":4}',110),
    ('Coil Nails 1-1/4"','f_125','{"base":"sq","divide_by":25,"min":1}',120),
    ('Plastic Cap Nails','f_pcn','{"base":"sq","divide_by":25,"min":1}',130),
    ('Caulking','a_np1','{"base":"sq","divide_by":5,"min":2}',140),
    ('Spray Paint','a_spray','{"fixed":2}',150),
    ('Flashing Cement','a_k19','{"base":"sq","divide_by":25,"min":1}',160),
    ('CDX Plywood (deck replace)','w_cdx','{"base":"deck_sheets"}',170),
    ('Delivery','d_local','{"fixed":1}',180),
    ('Fuel Surcharge','d_fuel','{"fixed":1}',190)
  ) x(label, mat_slug, formula, sort_order);
  INSERT INTO public.template_labor_lines (template_id, task, uom, rate, formula, sort_order)
  SELECT t_id, x.task, x.uom, x.rate, x.formula::jsonb, x.sort_order FROM (VALUES
    ('Tear-off existing roof','SQ',65,'{"base":"sq"}',10),
    ('Install shingle roof system','SQ',145,'{"base":"sq"}',20),
    ('Install hip/ridge cap','LF',4.5,'{"base":"hip_ridge_lf"}',30),
    ('Install drip edge','LF',2.25,'{"base":"eave_rake_lf"}',40),
    ('Install valley metal','LF',6.5,'{"base":"valley_lf"}',50),
    ('Install pipe flashings','EA',45,'{"base":"pipes"}',60),
    ('Install exhaust vents','EA',65,'{"base":"vents"}',70),
    ('Install ridge vent','LF',8,'{"base":"ridge_vent_lf"}',80),
    ('Deck replacement','SHEET',95,'{"base":"deck_sheets"}',90),
    ('Dump fees / disposal','LOT',450,'{"fixed":1}',100),
    ('Permit fee','LOT',350,'{"fixed":1}',110)
  ) x(task, uom, rate, formula, sort_order);

  -- TILE
  INSERT INTO public.roof_system_templates (company_id, slug, label, icon, inputs, sort_order)
  VALUES (NULL, 'tile', 'Tile Roof', 'Layers',
    '["sq","hip_ridge_lf","eave_rake_lf","valley_lf","pipes","vents","deck_sheets"]'::jsonb, 20)
  RETURNING id INTO t_id;
  INSERT INTO public.template_material_lines (template_id, label, default_material_id, formula, sort_order)
  SELECT t_id, x.label, (SELECT id FROM public.material_catalog WHERE company_id IS NULL AND slug = x.mat_slug), x.formula::jsonb, x.sort_order
  FROM (VALUES
    ('Field Tile','tile_eagle','{"base":"sq","waste_pct":8}',10),
    ('Hip/Ridge Trim Tile','tile_trim_eagle','{"base":"hip_ridge_lf","divide_by":1.1,"waste_pct":5}',20),
    ('Hip/Ridge Channel Metal','mt_hr_ch','{"base":"hip_ridge_lf","divide_by":50}',30),
    ('Tile Underlayment (Hi-Temp SA)','sa_poly_tup','{"base":"sq","divide_by":2,"waste_pct":10}',40),
    ('PolyAnchor HV Base','ul_poly_anchor','{"base":"sq","divide_by":2}',50),
    ('Drip Edge','mt_de','{"base":"eave_rake_lf","divide_by":10,"waste_pct":5}',60),
    ('Tile Valley Preformed','mt_tv','{"base":"valley_lf","divide_by":10}',70),
    ('Birdstop (Eave Closure)','mt_bird','{"base":"eave_rake_lf","divide_by":10}',80),
    ('Tile Pan-Flashing','mt_pan','{"base":"sq","divide_by":15,"min":2}',90),
    ('Tile Lead Boot (2")','pf_tlb2','{"base":"pipes"}',100),
    ('Tile Gooseneck','v_tile_gn4','{"base":"vents"}',110),
    ('O''Hagin Tile Vent','v_ohagin','{"base":"sq","divide_by":15,"min":2}',120),
    ('Tile Fasteners (2.5")','f_quik','{"base":"sq","divide_by":10,"min":1}',130),
    ('Coil Nails (underlayment)','f_125','{"base":"sq","divide_by":25,"min":1}',140),
    ('Tile Bond Adhesive Kit','tile_bond','{"base":"sq","divide_by":15,"min":1}',150),
    ('Tile Mortar','tile_mortar','{"base":"hip_ridge_lf","divide_by":8,"min":4}',160),
    ('Oxide Color','tile_oxide','{"fixed":1}',170),
    ('Caulking','a_titebond','{"base":"sq","divide_by":5,"min":2}',180),
    ('CDX Plywood (deck replace)','w_cdx','{"base":"deck_sheets"}',190),
    ('Delivery','d_local','{"fixed":1}',200),
    ('Fuel Surcharge','d_fuel','{"fixed":1}',210)
  ) x(label, mat_slug, formula, sort_order);
  INSERT INTO public.template_labor_lines (template_id, task, uom, rate, formula, sort_order)
  SELECT t_id, x.task, x.uom, x.rate, x.formula::jsonb, x.sort_order FROM (VALUES
    ('Tear-off existing tile roof','SQ',110,'{"base":"sq"}',10),
    ('Install tile roof system (loaded)','SQ',285,'{"base":"sq"}',20),
    ('Install hip/ridge tile + mortar','LF',14,'{"base":"hip_ridge_lf"}',30),
    ('Install valley metal & pans','LF',9,'{"base":"valley_lf"}',40),
    ('Install pipe flashings (tile)','EA',85,'{"base":"pipes"}',50),
    ('Install tile vents','EA',95,'{"base":"vents"}',60),
    ('Deck replacement','SHEET',95,'{"base":"deck_sheets"}',70),
    ('Dump fees / disposal','LOT',950,'{"fixed":1}',80),
    ('Permit fee','LOT',450,'{"fixed":1}',90)
  ) x(task, uom, rate, formula, sort_order);

  -- METAL
  INSERT INTO public.roof_system_templates (company_id, slug, label, icon, inputs, sort_order)
  VALUES (NULL, 'metal', 'Metal Roof', 'Wrench',
    '["sq","hip_ridge_lf","eave_rake_lf","valley_lf","pipes","vents","deck_sheets"]'::jsonb, 30)
  RETURNING id INTO t_id;
  INSERT INTO public.template_material_lines (template_id, label, default_material_id, formula, sort_order)
  SELECT t_id, x.label, (SELECT id FROM public.material_catalog WHERE company_id IS NULL AND slug = x.mat_slug), x.formula::jsonb, x.sort_order
  FROM (VALUES
    ('Hi-Temp Underlayment','sa_titanium_psu','{"base":"sq","divide_by":2,"waste_pct":10}',10),
    ('Drip Edge / Eave Trim','mt_de','{"base":"eave_rake_lf","divide_by":10,"waste_pct":5}',20),
    ('Valley Metal','mt_vr','{"base":"valley_lf","divide_by":50,"min":1}',30),
    ('Counter Flashing','mt_cf','{"base":"sq","divide_by":15,"min":2}',40),
    ('Wall / Step Flashing','mt_lf','{"base":"sq","divide_by":10,"min":2}',50),
    ('Pipe Flashing (Bullet 2")','pf_bb2','{"base":"pipes"}',60),
    ('Gooseneck Vent','v_gn4','{"base":"vents"}',70),
    ('Caulking (Polyurethane)','a_tspu','{"base":"sq","divide_by":5,"min":2}',80),
    ('Coil Nails','f_125','{"base":"sq","divide_by":25,"min":1}',90),
    ('CDX Plywood (deck replace)','w_cdx','{"base":"deck_sheets"}',100),
    ('Delivery','d_local','{"fixed":1}',110),
    ('Fuel Surcharge','d_fuel','{"fixed":1}',120)
  ) x(label, mat_slug, formula, sort_order);
  INSERT INTO public.template_labor_lines (template_id, task, uom, rate, formula, sort_order)
  SELECT t_id, x.task, x.uom, x.rate, x.formula::jsonb, x.sort_order FROM (VALUES
    ('Tear-off existing roof','SQ',75,'{"base":"sq"}',10),
    ('Install standing seam metal','SQ',425,'{"base":"sq"}',20),
    ('Install hip/ridge cap','LF',9,'{"base":"hip_ridge_lf"}',30),
    ('Install valley metal','LF',8,'{"base":"valley_lf"}',40),
    ('Install pipe flashings','EA',55,'{"base":"pipes"}',50),
    ('Install vents','EA',75,'{"base":"vents"}',60),
    ('Deck replacement','SHEET',95,'{"base":"deck_sheets"}',70),
    ('Dump fees / disposal','LOT',650,'{"fixed":1}',80),
    ('Permit fee','LOT',450,'{"fixed":1}',90)
  ) x(task, uom, rate, formula, sort_order);

  -- FLAT
  INSERT INTO public.roof_system_templates (company_id, slug, label, icon, inputs, sort_order)
  VALUES (NULL, 'flat', 'Flat / Low-Slope Roof', 'Cloud',
    '["sq","perimeter_lf","pipes","vents","deck_sheets"]'::jsonb, 40)
  RETURNING id INTO t_id;
  INSERT INTO public.template_material_lines (template_id, label, default_material_id, formula, sort_order)
  SELECT t_id, x.label, (SELECT id FROM public.material_catalog WHERE company_id IS NULL AND slug = x.mat_slug), x.formula::jsonb, x.sort_order
  FROM (VALUES
    ('Base Sheet (SA)','ls_poly_eb','{"base":"sq","divide_by":1,"waste_pct":10}',10),
    ('Cap Sheet (SA)','ls_poly_pf','{"base":"sq","divide_by":1,"waste_pct":10}',20),
    ('Flashing Cement','a_k19','{"base":"sq","divide_by":10,"min":2}',30),
    ('Spray Primer','a_prime','{"base":"perimeter_lf","divide_by":75,"min":2}',40),
    ('Drip Edge','mt_de','{"base":"perimeter_lf","divide_by":10,"waste_pct":5}',50),
    ('Pipe Flashing (Lead 2")','pf_lb2','{"base":"pipes"}',60),
    ('Gooseneck Vent','v_gn4','{"base":"vents"}',70),
    ('Coil Nails','f_125','{"base":"sq","divide_by":25,"min":1}',80),
    ('CDX Plywood (deck replace)','w_cdx','{"base":"deck_sheets"}',90),
    ('Delivery','d_local','{"fixed":1}',100),
    ('Fuel Surcharge','d_fuel','{"fixed":1}',110)
  ) x(label, mat_slug, formula, sort_order);
  INSERT INTO public.template_labor_lines (template_id, task, uom, rate, formula, sort_order)
  SELECT t_id, x.task, x.uom, x.rate, x.formula::jsonb, x.sort_order FROM (VALUES
    ('Tear-off existing flat roof','SQ',95,'{"base":"sq"}',10),
    ('Install 2-ply SA flat system','SQ',285,'{"base":"sq"}',20),
    ('Perimeter detail / drip','LF',5,'{"base":"perimeter_lf"}',30),
    ('Install pipe flashings','EA',55,'{"base":"pipes"}',40),
    ('Install vents','EA',75,'{"base":"vents"}',50),
    ('Deck replacement','SHEET',95,'{"base":"deck_sheets"}',60),
    ('Dump fees / disposal','LOT',550,'{"fixed":1}',70),
    ('Permit fee','LOT',350,'{"fixed":1}',80)
  ) x(task, uom, rate, formula, sort_order);

  -- GUTTERS
  INSERT INTO public.roof_system_templates (company_id, slug, label, icon, inputs, sort_order)
  VALUES (NULL, 'gutters', 'Gutters', 'Box',
    '["gutter_lf","downspouts","corners","endcaps"]'::jsonb, 50)
  RETURNING id INTO t_id;
  INSERT INTO public.template_material_lines (template_id, label, default_material_id, formula, sort_order)
  SELECT t_id, x.label, (SELECT id FROM public.material_catalog WHERE company_id IS NULL AND slug = x.mat_slug), x.formula::jsonb, x.sort_order
  FROM (VALUES
    ('6" Seamless Gutter','g_6al','{"base":"gutter_lf","waste_pct":5}',10),
    ('Downspouts','g_dspout','{"base":"downspouts"}',20),
    ('Inside/Outside Corners','g_corner','{"base":"corners"}',30),
    ('End Caps','g_endcap','{"base":"endcaps"}',40),
    ('Hidden Hangers','g_hanger','{"base":"gutter_lf","divide_by":2,"min":4}',50),
    ('Gutter Screws','g_screw','{"base":"gutter_lf","divide_by":100,"min":1}',60),
    ('Caulking','a_geo','{"base":"gutter_lf","divide_by":50,"min":2}',70),
    ('Delivery','d_local','{"fixed":1}',80)
  ) x(label, mat_slug, formula, sort_order);
  INSERT INTO public.template_labor_lines (template_id, task, uom, rate, formula, sort_order)
  SELECT t_id, x.task, x.uom, x.rate, x.formula::jsonb, x.sort_order FROM (VALUES
    ('Hang gutter','LF',7.5,'{"base":"gutter_lf"}',10),
    ('Install downspouts','EA',35,'{"base":"downspouts"}',20),
    ('Tear-off old gutter','LF',2,'{"base":"gutter_lf"}',30)
  ) x(task, uom, rate, formula, sort_order);
END $tpl$;
