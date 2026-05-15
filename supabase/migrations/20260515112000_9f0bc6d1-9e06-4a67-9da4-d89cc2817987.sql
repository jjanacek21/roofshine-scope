
-- ENUMS
CREATE TYPE invoice_status AS ENUM ('draft','sent','partial','paid','void','overdue');
CREATE TYPE invoice_template_kind AS ENUM ('preset','ai');
CREATE TYPE invoice_payment_method AS ENUM ('stripe','paypal','cash','check','ach','other');
CREATE TYPE invoice_payment_status AS ENUM ('pending','succeeded','failed','refunded');
CREATE TYPE invoice_line_kind AS ENUM ('catalog','custom');

-- TEMPLATES
CREATE TABLE public.invoice_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL,
  name text NOT NULL,
  kind invoice_template_kind NOT NULL DEFAULT 'preset',
  layout jsonb NOT NULL DEFAULT '{}'::jsonb,
  preview_url text,
  is_default boolean NOT NULL DEFAULT false,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.invoice_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "company members manage templates" ON public.invoice_templates
  FOR ALL TO authenticated
  USING (company_id = auth_company_id() OR is_super_admin())
  WITH CHECK (company_id = auth_company_id() OR is_super_admin());
CREATE TRIGGER trg_invoice_templates_updated BEFORE UPDATE ON public.invoice_templates
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- INVOICE NUMBER SEQUENCE PER COMPANY
CREATE TABLE public.invoice_number_sequences (
  company_id uuid NOT NULL,
  year int NOT NULL,
  next_value int NOT NULL DEFAULT 1,
  PRIMARY KEY (company_id, year)
);
ALTER TABLE public.invoice_number_sequences ENABLE ROW LEVEL SECURITY;
CREATE POLICY "company read sequences" ON public.invoice_number_sequences
  FOR SELECT TO authenticated USING (company_id = auth_company_id() OR is_super_admin());

-- INVOICES
CREATE TABLE public.invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL,
  job_id uuid,
  client_id uuid,
  template_id uuid REFERENCES public.invoice_templates(id) ON DELETE SET NULL,
  invoice_number text NOT NULL,
  status invoice_status NOT NULL DEFAULT 'draft',
  customer_name text,
  customer_email text,
  customer_phone text,
  customer_address text,
  issue_date date NOT NULL DEFAULT current_date,
  due_date date,
  currency text NOT NULL DEFAULT 'USD',
  notes text,
  terms text,
  subtotal numeric NOT NULL DEFAULT 0,
  discount numeric NOT NULL DEFAULT 0,
  tax_pct numeric NOT NULL DEFAULT 0,
  tax numeric NOT NULL DEFAULT 0,
  total numeric NOT NULL DEFAULT 0,
  amount_paid numeric NOT NULL DEFAULT 0,
  amount_due numeric NOT NULL DEFAULT 0,
  pdf_path text,
  public_pay_token text UNIQUE,
  sent_at timestamptz,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (company_id, invoice_number)
);
CREATE INDEX idx_invoices_company_status ON public.invoices(company_id, status);
CREATE INDEX idx_invoices_job ON public.invoices(job_id) WHERE job_id IS NOT NULL;
CREATE INDEX idx_invoices_client ON public.invoices(client_id) WHERE client_id IS NOT NULL;
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
CREATE POLICY "company members select invoices" ON public.invoices
  FOR SELECT TO authenticated USING (company_id = auth_company_id() OR is_super_admin());
CREATE POLICY "company members insert invoices" ON public.invoices
  FOR INSERT TO authenticated WITH CHECK (company_id = auth_company_id());
CREATE POLICY "company members update invoices" ON public.invoices
  FOR UPDATE TO authenticated USING (company_id = auth_company_id() OR is_super_admin());
CREATE POLICY "company members delete invoices" ON public.invoices
  FOR DELETE TO authenticated USING ((company_id = auth_company_id() AND is_company_admin()) OR is_super_admin());
CREATE TRIGGER trg_invoices_updated BEFORE UPDATE ON public.invoices
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- INVOICE LINE ITEMS
CREATE TABLE public.invoice_line_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id uuid NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
  sort_order int NOT NULL DEFAULT 0,
  kind invoice_line_kind NOT NULL DEFAULT 'custom',
  line_item_master_id uuid,
  name text NOT NULL,
  description text,
  qty numeric NOT NULL DEFAULT 1,
  unit text NOT NULL DEFAULT 'EA',
  unit_price numeric NOT NULL DEFAULT 0,
  total numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_invoice_line_items_invoice ON public.invoice_line_items(invoice_id);
ALTER TABLE public.invoice_line_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "company access invoice lines" ON public.invoice_line_items
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.invoices i WHERE i.id = invoice_id AND (i.company_id = auth_company_id() OR is_super_admin())))
  WITH CHECK (EXISTS (SELECT 1 FROM public.invoices i WHERE i.id = invoice_id AND i.company_id = auth_company_id()));

-- INVOICE PAYMENTS
CREATE TABLE public.invoice_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id uuid NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
  company_id uuid NOT NULL,
  method invoice_payment_method NOT NULL,
  amount numeric NOT NULL,
  currency text NOT NULL DEFAULT 'USD',
  status invoice_payment_status NOT NULL DEFAULT 'succeeded',
  provider_id text,
  provider_meta jsonb NOT NULL DEFAULT '{}'::jsonb,
  reference text,
  paid_at timestamptz NOT NULL DEFAULT now(),
  recorded_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_invoice_payments_invoice ON public.invoice_payments(invoice_id);
CREATE UNIQUE INDEX idx_invoice_payments_provider ON public.invoice_payments(method, provider_id) WHERE provider_id IS NOT NULL;
ALTER TABLE public.invoice_payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "company members select payments" ON public.invoice_payments
  FOR SELECT TO authenticated USING (company_id = auth_company_id() OR is_super_admin());
CREATE POLICY "company members insert payments" ON public.invoice_payments
  FOR INSERT TO authenticated WITH CHECK (company_id = auth_company_id());
CREATE POLICY "company admins update payments" ON public.invoice_payments
  FOR UPDATE TO authenticated USING ((company_id = auth_company_id() AND is_company_admin()) OR is_super_admin());
CREATE POLICY "company admins delete payments" ON public.invoice_payments
  FOR DELETE TO authenticated USING ((company_id = auth_company_id() AND is_company_admin()) OR is_super_admin());
CREATE TRIGGER trg_invoice_payments_updated BEFORE UPDATE ON public.invoice_payments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ===========================================================
-- Auto invoice number assignment
-- ===========================================================
CREATE OR REPLACE FUNCTION public.assign_invoice_number()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_year int;
  v_next int;
BEGIN
  IF NEW.invoice_number IS NOT NULL AND length(NEW.invoice_number) > 0 THEN
    RETURN NEW;
  END IF;
  v_year := EXTRACT(year FROM COALESCE(NEW.issue_date, current_date));
  INSERT INTO public.invoice_number_sequences (company_id, year, next_value)
    VALUES (NEW.company_id, v_year, 2)
    ON CONFLICT (company_id, year) DO UPDATE SET next_value = invoice_number_sequences.next_value + 1
    RETURNING next_value - 1 INTO v_next;
  NEW.invoice_number := 'INV-' || v_year || '-' || lpad(v_next::text, 4, '0');
  IF NEW.created_by IS NULL THEN NEW.created_by := auth.uid(); END IF;
  IF NEW.public_pay_token IS NULL THEN
    NEW.public_pay_token := encode(extensions.gen_random_bytes(24), 'hex');
  END IF;
  NEW.amount_due := COALESCE(NEW.total, 0) - COALESCE(NEW.amount_paid, 0);
  RETURN NEW;
END $$;

CREATE TRIGGER trg_invoices_assign_number BEFORE INSERT ON public.invoices
  FOR EACH ROW EXECUTE FUNCTION public.assign_invoice_number();

-- ===========================================================
-- Recompute invoice totals on payment changes
-- ===========================================================
CREATE OR REPLACE FUNCTION public.recompute_invoice_balance(_invoice_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_paid numeric;
  v_total numeric;
  v_due numeric;
  v_due_date date;
  v_status invoice_status;
  v_current_status invoice_status;
BEGIN
  SELECT total, due_date, status INTO v_total, v_due_date, v_current_status
    FROM public.invoices WHERE id = _invoice_id;
  IF NOT FOUND THEN RETURN; END IF;

  SELECT COALESCE(SUM(amount), 0) INTO v_paid
    FROM public.invoice_payments
    WHERE invoice_id = _invoice_id AND status = 'succeeded';

  v_due := COALESCE(v_total, 0) - v_paid;

  IF v_current_status = 'void' THEN
    v_status := 'void';
  ELSIF v_paid >= COALESCE(v_total, 0) AND COALESCE(v_total, 0) > 0 THEN
    v_status := 'paid';
  ELSIF v_paid > 0 THEN
    v_status := 'partial';
  ELSIF v_due_date IS NOT NULL AND v_due_date < current_date THEN
    v_status := 'overdue';
  ELSIF v_current_status IN ('sent','overdue') THEN
    v_status := CASE WHEN v_due_date IS NOT NULL AND v_due_date < current_date THEN 'overdue' ELSE 'sent' END;
  ELSE
    v_status := v_current_status;
  END IF;

  UPDATE public.invoices
     SET amount_paid = v_paid,
         amount_due = v_due,
         status = v_status,
         updated_at = now()
   WHERE id = _invoice_id;
END $$;

CREATE OR REPLACE FUNCTION public.trg_invoice_payment_recompute()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM public.recompute_invoice_balance(OLD.invoice_id);
    RETURN OLD;
  ELSE
    PERFORM public.recompute_invoice_balance(NEW.invoice_id);
    RETURN NEW;
  END IF;
END $$;

CREATE TRIGGER trg_invoice_payments_recompute
  AFTER INSERT OR UPDATE OR DELETE ON public.invoice_payments
  FOR EACH ROW EXECUTE FUNCTION public.trg_invoice_payment_recompute();

-- Recompute when invoice line items change (and roll subtotal/total)
CREATE OR REPLACE FUNCTION public.recompute_invoice_totals(_invoice_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_subtotal numeric;
  v_discount numeric;
  v_tax_pct numeric;
  v_tax numeric;
  v_total numeric;
BEGIN
  SELECT COALESCE(SUM(total), 0) INTO v_subtotal
    FROM public.invoice_line_items WHERE invoice_id = _invoice_id;
  SELECT discount, tax_pct INTO v_discount, v_tax_pct
    FROM public.invoices WHERE id = _invoice_id;
  v_tax := round((v_subtotal - COALESCE(v_discount, 0)) * (COALESCE(v_tax_pct, 0) / 100), 2);
  v_total := (v_subtotal - COALESCE(v_discount, 0)) + v_tax;
  UPDATE public.invoices
     SET subtotal = v_subtotal,
         tax = v_tax,
         total = v_total,
         updated_at = now()
   WHERE id = _invoice_id;
  PERFORM public.recompute_invoice_balance(_invoice_id);
END $$;

CREATE OR REPLACE FUNCTION public.trg_invoice_lines_recompute()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM public.recompute_invoice_totals(OLD.invoice_id);
    RETURN OLD;
  ELSE
    PERFORM public.recompute_invoice_totals(NEW.invoice_id);
    RETURN NEW;
  END IF;
END $$;

CREATE TRIGGER trg_invoice_lines_recompute
  AFTER INSERT OR UPDATE OR DELETE ON public.invoice_line_items
  FOR EACH ROW EXECUTE FUNCTION public.trg_invoice_lines_recompute();
