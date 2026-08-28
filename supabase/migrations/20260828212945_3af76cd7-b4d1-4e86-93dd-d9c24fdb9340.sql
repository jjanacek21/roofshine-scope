CREATE UNIQUE INDEX IF NOT EXISTS photo_learning_rules_unique
  ON public.photo_learning_rules (lower(match_phrase), coalesce(wrong_code,''), coalesce(company_id::text,''));

CREATE OR REPLACE FUNCTION public.learn_from_photo_decision()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  phrase text;
BEGIN
  IF NEW.decision NOT IN ('edited','rejected') THEN
    RETURN NEW;
  END IF;
  phrase := nullif(btrim(coalesce(NEW.ai_description, NEW.suggested_code)), '');
  IF phrase IS NULL THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.photo_learning_rules
    (company_id, trade, asset_type, match_phrase, wrong_code, correct_code, correct_unit, guidance, hits, created_by)
  VALUES (
    NEW.company_id, NEW.trade, NEW.asset_type, phrase,
    NEW.suggested_code,
    CASE WHEN NEW.decision = 'edited' THEN NEW.final_code ELSE NULL END,
    CASE WHEN NEW.decision = 'edited' THEN NEW.final_unit ELSE NULL END,
    CASE WHEN NEW.decision = 'rejected' THEN 'Do not suggest this line for that observation.' ELSE NULL END,
    1, NEW.decided_by
  )
  ON CONFLICT (lower(match_phrase), coalesce(wrong_code,''), coalesce(company_id::text,''))
  DO UPDATE SET
    hits = public.photo_learning_rules.hits + 1,
    correct_code = coalesce(excluded.correct_code, public.photo_learning_rules.correct_code),
    correct_unit = coalesce(excluded.correct_unit, public.photo_learning_rules.correct_unit),
    guidance = coalesce(excluded.guidance, public.photo_learning_rules.guidance),
    updated_at = now();

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_learn_from_photo_decision ON public.photo_suggestion_decisions;
CREATE TRIGGER trg_learn_from_photo_decision
AFTER INSERT OR UPDATE OF decision, final_code ON public.photo_suggestion_decisions
FOR EACH ROW EXECUTE FUNCTION public.learn_from_photo_decision();

REVOKE EXECUTE ON FUNCTION public.learn_from_photo_decision() FROM anon, authenticated, public;