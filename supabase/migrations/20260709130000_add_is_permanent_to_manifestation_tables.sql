ALTER TABLE public.awakener_tag_manifestation
  ADD COLUMN IF NOT EXISTS is_permanent boolean;

ALTER TABLE public.covenant_tag_manifestation
  ADD COLUMN IF NOT EXISTS is_permanent boolean;

ALTER TABLE public.posse_tag_manifestation
  ADD COLUMN IF NOT EXISTS is_permanent boolean;

ALTER TABLE public.wheel_tag_manifestation
  ADD COLUMN IF NOT EXISTS is_permanent boolean;
