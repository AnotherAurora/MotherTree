ALTER TABLE public.realm_tag_manifestation
  ADD COLUMN IF NOT EXISTS dependency_rate_stat public.all_stats;
