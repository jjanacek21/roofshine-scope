
ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS bank_instructions jsonb DEFAULT '{}'::jsonb;

ALTER TABLE public.invoice_templates ALTER COLUMN company_id DROP NOT NULL;

DROP POLICY IF EXISTS "Anyone can read system templates" ON public.invoice_templates;
CREATE POLICY "Anyone can read system templates"
  ON public.invoice_templates FOR SELECT
  USING (company_id IS NULL);

INSERT INTO public.invoice_templates (company_id, name, kind, layout, is_default) VALUES
  (NULL, 'Classic', 'preset',
   '{"theme":"classic","accent":"#1e40af","accent_text":"#ffffff","bg":"#ffffff","text":"#0f172a","muted":"#64748b","heading_font":"serif","body_font":"sans-serif","header_style":"banner","table_style":"lined","logo_position":"left","show_accent_stripe":true}'::jsonb,
   true),
  (NULL, 'Modern', 'preset',
   '{"theme":"modern","accent":"#0f172a","accent_text":"#ffffff","bg":"#ffffff","text":"#0f172a","muted":"#64748b","heading_font":"sans-serif","body_font":"sans-serif","header_style":"split","table_style":"zebra","logo_position":"right","show_accent_stripe":false}'::jsonb,
   false),
  (NULL, 'Minimal', 'preset',
   '{"theme":"minimal","accent":"#000000","accent_text":"#ffffff","bg":"#ffffff","text":"#0f172a","muted":"#94a3b8","heading_font":"sans-serif","body_font":"sans-serif","header_style":"clean","table_style":"borderless","logo_position":"left","show_accent_stripe":false}'::jsonb,
   false),
  (NULL, 'Bold', 'preset',
   '{"theme":"bold","accent":"#dc2626","accent_text":"#ffffff","bg":"#fafafa","text":"#0f172a","muted":"#525252","heading_font":"sans-serif","body_font":"sans-serif","header_style":"block","table_style":"boxed","logo_position":"left","show_accent_stripe":true}'::jsonb,
   false);
