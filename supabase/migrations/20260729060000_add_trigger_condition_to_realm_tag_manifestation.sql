ALTER TABLE public.realm_tag_manifestation
  ADD COLUMN IF NOT EXISTS trigger_condition integer
  REFERENCES public.tag(id) ON DELETE NO ACTION;
