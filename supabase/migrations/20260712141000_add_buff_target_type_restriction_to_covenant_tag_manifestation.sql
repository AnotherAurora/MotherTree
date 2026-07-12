ALTER TABLE public.covenant_tag_manifestation
  ADD COLUMN IF NOT EXISTS buff_target_type_restriction public.source_type;
