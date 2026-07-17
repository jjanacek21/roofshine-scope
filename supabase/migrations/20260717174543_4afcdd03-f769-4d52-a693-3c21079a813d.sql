
-- =========================
-- SPF Calculator catalog
-- =========================

CREATE TABLE public.spf_products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  solids_pct numeric NOT NULL,
  cost_per_gal numeric NOT NULL,
  default_mils numeric NOT NULL,
  default_method text NOT NULL CHECK (default_method IN ('spray','roll','brush')),
  role text NOT NULL CHECK (role IN ('primer','detail','base','top')),
  sort_order int NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.spf_products TO authenticated;
GRANT ALL ON public.spf_products TO service_role;
ALTER TABLE public.spf_products ENABLE ROW LEVEL SECURITY;
CREATE POLICY "spf_products read" ON public.spf_products FOR SELECT TO authenticated USING (true);
CREATE POLICY "spf_products admin write" ON public.spf_products FOR ALL TO authenticated
  USING (public.is_super_admin()) WITH CHECK (public.is_super_admin());

CREATE TABLE public.spf_details (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  label text NOT NULL,
  unit text NOT NULL CHECK (unit IN ('ea','lf','ls')),
  default_qty numeric NOT NULL DEFAULT 0,
  unit_cost numeric NOT NULL DEFAULT 0,
  sort_order int NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.spf_details TO authenticated;
GRANT ALL ON public.spf_details TO service_role;
ALTER TABLE public.spf_details ENABLE ROW LEVEL SECURITY;
CREATE POLICY "spf_details read" ON public.spf_details FOR SELECT TO authenticated USING (true);
CREATE POLICY "spf_details admin write" ON public.spf_details FOR ALL TO authenticated
  USING (public.is_super_admin()) WITH CHECK (public.is_super_admin());

CREATE TABLE public.spf_stacks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text NOT NULL UNIQUE,
  label text NOT NULL,
  sort_order int NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.spf_stacks TO authenticated;
GRANT ALL ON public.spf_stacks TO service_role;
ALTER TABLE public.spf_stacks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "spf_stacks read" ON public.spf_stacks FOR SELECT TO authenticated USING (true);
CREATE POLICY "spf_stacks admin write" ON public.spf_stacks FOR ALL TO authenticated
  USING (public.is_super_admin()) WITH CHECK (public.is_super_admin());

CREATE TABLE public.spf_stack_layers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  stack_id uuid NOT NULL REFERENCES public.spf_stacks(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES public.spf_products(id) ON DELETE RESTRICT,
  scope text NOT NULL CHECK (scope IN ('field','pct','seams','details','custom')),
  amount numeric NOT NULL DEFAULT 100,
  method text NOT NULL CHECK (method IN ('spray','roll','brush')),
  mils numeric NOT NULL,
  sort_order int NOT NULL DEFAULT 0,
  on_by_default boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.spf_stack_layers TO authenticated;
GRANT ALL ON public.spf_stack_layers TO service_role;
ALTER TABLE public.spf_stack_layers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "spf_stack_layers read" ON public.spf_stack_layers FOR SELECT TO authenticated USING (true);
CREATE POLICY "spf_stack_layers admin write" ON public.spf_stack_layers FOR ALL TO authenticated
  USING (public.is_super_admin()) WITH CHECK (public.is_super_admin());

CREATE TABLE public.spf_field_defaults (
  field_key text PRIMARY KEY,
  label text NOT NULL,
  group_key text NOT NULL,
  value_text text NOT NULL,
  simple_mode boolean NOT NULL DEFAULT false,
  sort_order int NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.spf_field_defaults TO authenticated;
GRANT ALL ON public.spf_field_defaults TO service_role;
ALTER TABLE public.spf_field_defaults ENABLE ROW LEVEL SECURITY;
CREATE POLICY "spf_field_defaults read" ON public.spf_field_defaults FOR SELECT TO authenticated USING (true);
CREATE POLICY "spf_field_defaults admin write" ON public.spf_field_defaults FOR ALL TO authenticated
  USING (public.is_super_admin()) WITH CHECK (public.is_super_admin());

CREATE TABLE public.spf_calc_settings (
  id boolean PRIMARY KEY DEFAULT true CHECK (id = true),
  default_mode text NOT NULL DEFAULT 'detailed' CHECK (default_mode IN ('simple','detailed')),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.spf_calc_settings TO authenticated;
GRANT ALL ON public.spf_calc_settings TO service_role;
ALTER TABLE public.spf_calc_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "spf_calc_settings read" ON public.spf_calc_settings FOR SELECT TO authenticated USING (true);
CREATE POLICY "spf_calc_settings admin write" ON public.spf_calc_settings FOR ALL TO authenticated
  USING (public.is_super_admin()) WITH CHECK (public.is_super_admin());
INSERT INTO public.spf_calc_settings (id) VALUES (true);

-- updated_at trigger
CREATE OR REPLACE FUNCTION public.spf_touch_updated_at() RETURNS trigger
LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END $$;

CREATE TRIGGER spf_products_touch BEFORE UPDATE ON public.spf_products FOR EACH ROW EXECUTE FUNCTION public.spf_touch_updated_at();
CREATE TRIGGER spf_details_touch BEFORE UPDATE ON public.spf_details FOR EACH ROW EXECUTE FUNCTION public.spf_touch_updated_at();
CREATE TRIGGER spf_stacks_touch BEFORE UPDATE ON public.spf_stacks FOR EACH ROW EXECUTE FUNCTION public.spf_touch_updated_at();
CREATE TRIGGER spf_stack_layers_touch BEFORE UPDATE ON public.spf_stack_layers FOR EACH ROW EXECUTE FUNCTION public.spf_touch_updated_at();
CREATE TRIGGER spf_field_defaults_touch BEFORE UPDATE ON public.spf_field_defaults FOR EACH ROW EXECUTE FUNCTION public.spf_touch_updated_at();
CREATE TRIGGER spf_calc_settings_touch BEFORE UPDATE ON public.spf_calc_settings FOR EACH ROW EXECUTE FUNCTION public.spf_touch_updated_at();

-- =========================
-- Seed products (order preserved as index 0..16)
-- =========================
INSERT INTO public.spf_products (name, solids_pct, cost_per_gal, default_mils, default_method, role, sort_order) VALUES
('Rust-inhibitive primer (metal)', 45, 38, 3, 'roll', 'primer', 0),
('Epoxy primer', 65, 62, 4, 'spray', 'primer', 1),
('Bleed-block / stain primer', 40, 42, 3, 'spray', 'primer', 2),
('SPF tie coat / adhesion primer', 50, 40, 3, 'spray', 'primer', 3),
('Butyl rubber seam sealant', 60, 48, 20, 'brush', 'detail', 4),
('Mastic / detail cement', 80, 34, 60, 'brush', 'detail', 5),
('Acrylic base coat', 52, 19, 15, 'spray', 'base', 6),
('Acrylic top coat — high solids', 62, 26, 15, 'spray', 'top', 7),
('Silicone base coat', 92, 44, 12, 'spray', 'base', 8),
('Silicone top coat — high solids', 98, 52, 12, 'spray', 'top', 9),
('Silicone — single coat', 98, 52, 24, 'spray', 'base', 10),
('Polyurethane base — aromatic', 70, 58, 12, 'spray', 'base', 11),
('Polyurethane top — aliphatic', 65, 72, 8, 'spray', 'top', 12),
('Polyurea', 100, 78, 40, 'spray', 'base', 13),
('Rubber / butyl coating', 60, 46, 25, 'spray', 'base', 14),
('Aluminum reflective coating', 45, 32, 10, 'roll', 'top', 15),
('Custom product', 100, 50, 20, 'spray', 'base', 16);

-- Seed details
INSERT INTO public.spf_details (label, unit, default_qty, unit_cost, sort_order) VALUES
('Small penetration (<4" pipe)', 'ea', 0, 95, 0),
('Large penetration / cluster', 'ea', 0, 240, 1),
('Pitch pan — new, filled', 'ea', 0, 185, 2),
('Roof drain — reset & flash', 'ea', 0, 420, 3),
('Drain replacement', 'ea', 0, 1150, 4),
('Scupper / thru-wall', 'ea', 0, 275, 5),
('HVAC curb — flash around', 'ea', 0, 310, 6),
('HVAC unit — lift, foam under, re-set', 'ea', 0, 1450, 7),
('Exhaust fan / vent curb', 'ea', 0, 225, 8),
('Skylight — flash perimeter', 'ea', 0, 340, 9),
('Skylight replacement', 'ea', 0, 1600, 10),
('Roof hatch — flash', 'ea', 0, 290, 11),
('Equipment / pipe support — raise & block', 'ea', 0, 165, 12),
('Satellite / antenna base', 'ea', 0, 275, 13),
('Lightning protection — detach & reset', 'ea', 0, 0, 14),
('Solar array — detach & reset (per panel)', 'ea', 0, 0, 15),
('Rusted fastener — treat / replace', 'ea', 0, 4.5, 16),
('Parapet / curb wall — foam & coat', 'lf', 0, 11, 17),
('Wall termination bar + sealant', 'lf', 0, 7.5, 18),
('Counterflashing — new metal', 'lf', 0, 14, 19),
('Edge metal / drip edge — new', 'lf', 0, 12, 20),
('Coping cap — new', 'lf', 0, 26, 21),
('Gutter / downspout', 'lf', 0, 18, 22),
('Expansion joint — new cover', 'lf', 0, 42, 23),
('Ridge / hip seam detail (metal)', 'lf', 0, 4.5, 24),
('Walkway pad / granule path', 'lf', 0, 9, 25),
('Crickets — sheet metal', 'ea', 0, 285, 26),
('Tie-in to adjacent roof', 'lf', 0, 22, 27),
('Fall protection anchor / warning line', 'ls', 0, 0, 28);

-- Seed stacks
INSERT INTO public.spf_stacks (key, label, sort_order) VALUES
('sil2', 'Silicone (2-coat)', 0),
('sil1', 'Silicone (single-coat)', 1),
('acr2', 'Acrylic (2-coat)', 2),
('rust', 'Rust / metal system', 3),
('pu',   'Polyurethane (2-coat)', 4);

-- Seed stack layers by referencing products via sort_order
INSERT INTO public.spf_stack_layers (stack_id, product_id, scope, amount, method, mils, sort_order)
SELECT s.id, p.id, l.scope, l.amount, l.method, l.mils, l.sort_order
FROM (VALUES
  ('sil2', 8,  'field', 100, 'spray', 12, 0),
  ('sil2', 9,  'field', 100, 'spray', 12, 1),
  ('sil1', 10, 'field', 100, 'spray', 24, 0),
  ('acr2', 6,  'field', 100, 'spray', 15, 0),
  ('acr2', 7,  'field', 100, 'spray', 15, 1),
  ('rust', 0,  'field', 100, 'roll',   3, 0),
  ('rust', 4,  'seams',   0, 'brush', 20, 1),
  ('rust', 6,  'field', 100, 'spray', 15, 2),
  ('rust', 7,  'field', 100, 'spray', 15, 3),
  ('pu',   11, 'field', 100, 'spray', 12, 0),
  ('pu',   12, 'field', 100, 'spray',  8, 1)
) AS l(stack_key, product_idx, scope, amount, method, mils, sort_order)
JOIN public.spf_stacks s ON s.key = l.stack_key
JOIN public.spf_products p ON p.sort_order = l.product_idx;

-- Seed field defaults
INSERT INTO public.spf_field_defaults (field_key, label, group_key, value_text, simple_mode, sort_order) VALUES
-- Project
('p_name','Project name','project','Untitled Commercial SPF', true, 0),
('p_addr','Address','project','', true, 1),
('p_sqft','Roof sq ft','project','20000', true, 2),
('p_areawaste','Area waste %','project','3', false, 3),
('p_geo','Geo multiplier','project','1.10', false, 4),
('p_slope','Slope multiplier','project','1.00', false, 5),
-- Existing
('e_deck','Deck type','existing','steel', false, 10),
('e_surf','Existing surface','existing','burs', false, 11),
('e_layers','Existing layers','existing','1', false, 12),
('e_tear','Tear-off','existing','0', false, 13),
('e_tearcost','Tear-off $/sq','existing','115', false, 14),
('e_disp','Disposal $/sq','existing','45', false, 15),
('e_deckrep','Deck repair sf','existing','0', false, 16),
('e_deckrepc','Deck repair $/sf','existing','14', false, 17),
('e_prep','Prep level','existing','0.22', false, 18),
('e_rustpct','Rust %','existing','0', false, 19),
('e_rustm','Rust method','existing','0.35', false, 20),
('e_mildew','Mildew treat sf','existing','0', false, 21),
('e_fast','Fastener sf','existing','0', false, 22),
('e_dry','Dry-out sf','existing','0', false, 23),
-- Access
('a_ht','Building height ft','access','24', false, 30),
('a_hose','Hose run ft','access','200', false, 31),
('a_method','Access method','access','1', false, 32),
('a_liftrate','Lift $/day','access','0', false, 33),
('a_liftdays','Lift days','access','0', false, 34),
('a_liftdel','Lift delivery $','access','0', false, 35),
('a_cranerate','Crane $/hr','access','285', false, 36),
('a_cranehrs','Crane hrs','access','0', false, 37),
('a_hoist','Hoist $','access','0', false, 38),
('a_occ','Occupied mult','access','1.00', false, 39),
('a_overspray','Overspray protect $','access','1200', false, 40),
('a_screens','Screens $','access','0', false, 41),
('a_shift','Shift mult','access','1.00', false, 42),
-- Foam
('f_on','Foam on','foam','1', true, 50),
('f_dens','Density lb','foam','3.0', false, 51),
('f_thick','Thickness in','foam','1.5', true, 52),
('f_taper','Taper in','foam','0', false, 53),
('f_yield','Yield bf/set','foam','4000', false, 54),
('f_waste','Waste %','foam','12', false, 55),
('f_cost','Set cost $','foam','2150', false, 56),
('f_freight','Freight $/set','foam','85', false, 57),
('f_amb','Ambient mult','foam','1.00', false, 58),
('f_tex','Texture mils','foam','18', false, 59),
-- Reinforcement
('r_lf','Reinforcement LF','reinf','0', false, 70),
('r_w','Fabric width in','reinf','6', false, 71),
('r_type','Fabric type','reinf','0.42', false, 72),
('r_c','Fabric override $','reinf','0', false, 73),
('r_rate','Install rate lf/day','reinf','600', false, 74),
('r_fieldpct','Field fabric %','reinf','0', false, 75),
('r_fieldc','Field fabric $/sf','reinf','0.42', false, 76),
-- Labor
('l_foamrate','Foam sf/day','labor','5000', false, 80),
('l_preprate','Prep sf/day','labor','12000', false, 81),
('l_rustrate','Rust sf/day','labor','2500', false, 82),
('l_tearrate','Tear-off sf/hr','labor','18', false, 83),
('l_crew','Crew size','labor','4', false, 84),
('l_wage','Wage $/hr','labor','34', false, 85),
('l_hrs','Hours/day','labor','9', false, 86),
('l_burden','Burden %','labor','34', false, 87),
('l_mobs','Mobs','labor','1', false, 88),
('l_mobc','Mob $ each','labor','1400', false, 89),
('l_diem','Per diem days','labor','0', false, 90),
('l_lodge','Lodging $','labor','0', false, 91),
('l_wx','Weather days','labor','1', false, 92),
('l_super','Super $/day','labor','380', false, 93),
-- Equipment
('q_rig','Rig $/day','equip','450', false, 100),
('q_fuel','Fuel $/day','equip','140', false, 101),
('q_pump','Pump $/day','equip','95', false, 102),
('q_wash','Wash $/day','equip','65', false, 103),
('q_cons','Consumables $/day','equip','185', false, 104),
('q_hand','Hand tools $','equip','0', false, 105),
('q_dump','Dumpsters','equip','0', false, 106),
('q_dumpc','Dumpster $','equip','695', false, 107),
('q_trailer','Trailer $','equip','0', false, 108),
('q_veh','Vehicle $/day','equip','90', false, 109),
-- Soft
('s_eng','Engineering','soft','2500', false, 120),
('s_engov','Eng override $','soft','0', false, 121),
('s_pbasis','Permit basis','soft','pct', false, 122),
('s_ppct','Permit %','soft','2.2', false, 123),
('s_pflat','Permit flat $','soft','425', false, 124),
('s_plan','Plans $','soft','350', false, 125),
('s_insp','Inspection $/day','soft','3', false, 126),
('s_inspc','Inspection consult $','soft','0', false, 127),
('s_noa','NOA $','soft','0', false, 128),
('s_ir','IR scan $','soft','0', false, 129),
('s_core','Cores $','soft','450', false, 130),
('s_mock','Mockup $','soft','0', false, 131),
('s_3rd','3rd party $','soft','0', false, 132),
('s_war','Warranty tier','soft','0.12', false, 133),
('s_warfee','Warranty fee $','soft','0', false, 134),
-- Markups
('m_tax','Tax %','markup','7', true, 150),
('m_cont','Contingency %','markup','4', true, 151),
('m_gl','GL %','markup','1.6', false, 152),
('m_bond','Bond %','markup','0', false, 153),
('m_oh','Overhead %','markup','11', true, 154),
('m_comm','Commission %','markup','6', false, 155),
('m_margin','Margin %','markup','28', true, 156),
('m_fin','Finance %','markup','0', false, 157);
