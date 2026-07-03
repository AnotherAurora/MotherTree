ALTER TABLE public.awakener_tag_manifestation
  ADD COLUMN is_accumulating boolean;

UPDATE public.awakener_tag_manifestation
SET is_accumulating = (ramp_turns = 2);

ALTER TABLE public.awakener_tag_manifestation
  ALTER COLUMN is_accumulating SET NOT NULL,
  ALTER COLUMN is_accumulating SET DEFAULT false;

ALTER TABLE public.awakener_tag_manifestation
  DROP COLUMN ramp_turns;
