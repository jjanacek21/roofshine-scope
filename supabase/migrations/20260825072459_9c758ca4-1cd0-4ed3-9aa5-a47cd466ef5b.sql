ALTER TABLE public.cb_workspaces
  ADD COLUMN IF NOT EXISTS stripe_customer_id text,
  ADD COLUMN IF NOT EXISTS stripe_subscription_id text;

CREATE TABLE IF NOT EXISTS public.cb_seat_purchases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.cb_workspaces(id) ON DELETE CASCADE,
  seats integer NOT NULL,
  unit_amount numeric NOT NULL DEFAULT 0,
  plan text NOT NULL DEFAULT 'pro',
  environment text NOT NULL DEFAULT 'sandbox',
  status text NOT NULL DEFAULT 'pending',
  stripe_session_id text,
  stripe_subscription_id text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS cb_seat_purchases_session_idx
  ON public.cb_seat_purchases (stripe_session_id) WHERE stripe_session_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS cb_seat_purchases_ws_idx ON public.cb_seat_purchases (workspace_id, created_at DESC);

GRANT SELECT ON public.cb_seat_purchases TO authenticated;
GRANT ALL ON public.cb_seat_purchases TO service_role;

ALTER TABLE public.cb_seat_purchases ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Workspace admins read seat purchases" ON public.cb_seat_purchases;
CREATE POLICY "Workspace admins read seat purchases"
  ON public.cb_seat_purchases FOR SELECT TO authenticated
  USING (public.cb_is_admin(workspace_id) OR public.cb_is_super_admin());