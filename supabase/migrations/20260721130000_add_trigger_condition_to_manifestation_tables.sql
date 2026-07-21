ALTER TABLE public.awakener_tag_manifestation
  ADD COLUMN IF NOT EXISTS trigger_condition integer
  REFERENCES public.tag(id) ON DELETE NO ACTION;

ALTER TABLE public.wheel_tag_manifestation
  ADD COLUMN IF NOT EXISTS trigger_condition integer
  REFERENCES public.tag(id) ON DELETE NO ACTION;

ALTER TABLE public.covenant_tag_manifestation
  ADD COLUMN IF NOT EXISTS trigger_condition integer
  REFERENCES public.tag(id) ON DELETE NO ACTION;
