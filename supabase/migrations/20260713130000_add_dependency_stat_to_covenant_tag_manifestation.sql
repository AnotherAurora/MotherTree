ALTER TABLE public.covenant_tag_manifestation
  ADD COLUMN IF NOT EXISTS dependency_stat public.all_stats;
