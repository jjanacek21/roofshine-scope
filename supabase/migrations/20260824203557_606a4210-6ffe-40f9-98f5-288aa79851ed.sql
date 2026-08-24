ALTER TABLE public.cb_workspaces
  ADD COLUMN IF NOT EXISTS billing_status text NOT NULL DEFAULT 'trialing',
  ADD COLUMN IF NOT EXISTS trial_started_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS trial_ends_at timestamptz NOT NULL DEFAULT (now() + interval '30 days'),
  ADD COLUMN IF NOT EXISTS canceled_at timestamptz;

CREATE OR REPLACE FUNCTION public.cb_set_seats(_ws uuid, _seats integer)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_seats integer := greatest(3, least(50, coalesce(_seats, 3)));
BEGIN
  IF NOT public.cb_is_owner(_ws) THEN
    RAISE EXCEPTION 'Only the workspace owner can change seats';
  END IF;
  UPDATE public.cb_workspaces SET seats_purchased = v_seats, updated_at = now() WHERE id = _ws;
  RETURN jsonb_build_object('ok', true, 'seats', v_seats);
END;
$$;

CREATE OR REPLACE FUNCTION public.cb_cancel_trial(_ws uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.cb_is_owner(_ws) THEN
    RAISE EXCEPTION 'Only the workspace owner can cancel';
  END IF;
  UPDATE public.cb_workspaces
     SET billing_status = 'canceled', canceled_at = now(), updated_at = now()
   WHERE id = _ws;
  RETURN jsonb_build_object('ok', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.cb_set_seats(uuid, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.cb_cancel_trial(uuid) TO authenticated;