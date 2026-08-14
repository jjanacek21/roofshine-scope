ALTER TABLE public.cb_photos
  DROP CONSTRAINT IF EXISTS cb_photos_shot_type_check;

ALTER TABLE public.cb_photos
  ADD CONSTRAINT cb_photos_shot_type_check
  CHECK (
    shot_type IS NULL OR
    shot_type IN ('wide', 'medium', 'close', 'test_square', 'overview', 'room', 'detail')
  );