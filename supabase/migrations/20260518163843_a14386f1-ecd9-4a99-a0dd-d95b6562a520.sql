
-- 1. jobs.roof_system
ALTER TABLE public.jobs
  ADD COLUMN IF NOT EXISTS roof_system text;

-- 2. companies.include_fl_code_package
ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS include_fl_code_package boolean NOT NULL DEFAULT true;

-- 3. Seed master line items (company_id IS NULL = master / global fallback).
--    Idempotent on (code) where company_id is null.
INSERT INTO public.line_item_master (company_id, code, name, unit, trade, category, default_price, status)
VALUES
  -- Laminated shingle system
  (NULL, 'RFG-LAM-COMP',   'Laminated comp. shingle roofing - w/ felt',         'SQ', 'roofing'::trade_type, 'shingles',     325.00, 'active'),
  (NULL, 'RFG-STARTER',    'Asphalt starter course',                            'LF', 'roofing'::trade_type, 'shingles',       2.10, 'active'),
  (NULL, 'RFG-HIPRIDGE',   'Hip / Ridge cap - High profile',                    'LF', 'roofing'::trade_type, 'shingles',       6.85, 'active'),
  (NULL, 'RFG-DRIPEDGE',   'Drip edge',                                         'LF', 'roofing'::trade_type, 'shingles',       2.95, 'active'),
  (NULL, 'RFG-RIDGEVENT',  'Continuous ridge vent - shingle-over style',        'LF', 'roofing'::trade_type, 'shingles',      11.50, 'active'),
  (NULL, 'RFG-OFFRIDGE',   'Roof vent - turtle type - Metal',                   'EA', 'roofing'::trade_type, 'shingles',      78.00, 'active'),
  (NULL, 'RFG-PIPEBOOT',   'Flashing - pipe jack',                              'EA', 'roofing'::trade_type, 'shingles',      48.00, 'active'),
  (NULL, 'RFG-VALLEY',     'Valley metal',                                      'LF', 'roofing'::trade_type, 'shingles',       7.20, 'active'),
  (NULL, 'EXT-GUTTER-6',   'Gutter / downspout - aluminum - up to 6"',          'LF', 'exterior'::trade_type, 'gutters',       9.40, 'active'),
  -- Tile system
  (NULL, 'RFG-TILE-CONC',  'Roof tile - concrete - "S" or flat',                'SQ', 'roofing'::trade_type, 'tile_roofing', 685.00, 'active'),
  (NULL, 'RFG-TILE-CLAY',  'Roof tile - clay - "S" or flat',                    'SQ', 'roofing'::trade_type, 'tile_roofing', 820.00, 'active'),
  (NULL, 'RFG-TILE-START', 'Tile - eave closure / starter',                     'LF', 'roofing'::trade_type, 'tile_roofing',   8.60, 'active'),
  (NULL, 'RFG-TILE-RIDGE', 'Tile - hip / ridge - mortar set',                   'LF', 'roofing'::trade_type, 'tile_roofing',  17.50, 'active'),
  (NULL, 'RFG-TILE-BATTEN','Tile - battens - 1x4 PT',                           'SQ', 'roofing'::trade_type, 'tile_roofing',  42.00, 'active'),
  -- Metal system
  (NULL, 'RFG-METAL-SS',   'Metal roofing - standing seam - 24ga',              'SQ', 'roofing'::trade_type, 'metal_roofing',780.00, 'active'),
  (NULL, 'RFG-METAL-SD',   'Metal roofing - 5V/screw-down - 26ga',              'SQ', 'roofing'::trade_type, 'metal_roofing',520.00, 'active'),
  (NULL, 'RFG-METAL-CLOS', 'Metal roofing - closure strip - foam',              'LF', 'roofing'::trade_type, 'metal_roofing',  3.20, 'active'),
  (NULL, 'RFG-METAL-RIDGE','Metal roofing - ridge cap',                         'LF', 'roofing'::trade_type, 'metal_roofing', 11.80, 'active'),
  -- Modified bitumen system
  (NULL, 'RFG-MODBIT-BASE','Modified bitumen - base sheet',                     'SQ', 'roofing'::trade_type, 'modified_bitumen', 165.00, 'active'),
  (NULL, 'RFG-MODBIT-CAP', 'Modified bitumen - cap sheet (torch / SBS)',        'SQ', 'roofing'::trade_type, 'modified_bitumen', 285.00, 'active'),
  (NULL, 'RFG-MODBIT-EDGE','Modified bitumen - edge metal',                     'LF', 'roofing'::trade_type, 'modified_bitumen',   4.60, 'active'),
  (NULL, 'RFG-MODBIT-WALK','Modified bitumen - walkway pads',                   'EA', 'roofing'::trade_type, 'modified_bitumen',  55.00, 'active'),
  -- Florida code package
  (NULL, 'FL-FELT-30-DBL', 'Double 30# felt underlayment w/ seam tape (FBC)',   'SQ', 'roofing'::trade_type, 'underlayment',  68.00, 'active'),
  (NULL, 'FL-PERIM-BUTYL', 'Butyl rubber perimeter seal (FBC HVHZ)',            'LF', 'roofing'::trade_type, 'underlayment',   2.40, 'active'),
  (NULL, 'FL-RENAIL',      'Re-nail roof decking to current FBC',               'SQ', 'roofing'::trade_type, 'tear_off',      42.00, 'active'),
  (NULL, 'FL-PERMIT',      'Building permit & inspection fee',                  'EA', 'roofing'::trade_type, 'tear_off',     385.00, 'active')
ON CONFLICT DO NOTHING;
