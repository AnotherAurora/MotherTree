-- Add trigger_condition (FK tag) and dependency_stat (all_stats) to relic_tag_manifestation,
-- mirroring the other gear manifestation tables so relic effects can record conditional
-- and stat-dependent scalars.

ALTER TABLE public.relic_tag_manifestation
  ADD COLUMN IF NOT EXISTS trigger_condition integer
  REFERENCES public.tag(id) ON DELETE NO ACTION;

ALTER TABLE public.relic_tag_manifestation
  ADD COLUMN IF NOT EXISTS dependency_stat public.all_stats;
