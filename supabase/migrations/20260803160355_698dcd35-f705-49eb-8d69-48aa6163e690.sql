CREATE POLICY "Super admins manage all estimates"
ON public.estimates FOR ALL TO authenticated
USING (is_super_admin()) WITH CHECK (is_super_admin());

CREATE POLICY "Super admins manage all estimate line items"
ON public.estimate_line_items FOR ALL TO authenticated
USING (is_super_admin()) WITH CHECK (is_super_admin());