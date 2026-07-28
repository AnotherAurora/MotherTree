ALTER TYPE public.realm_match_mode ADD VALUE IF NOT EXISTS 'combo';

ALTER TABLE public.realm_tag_manifestation
  ADD COLUMN IF NOT EXISTS doubles_when_pure boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS dependency_stat public.all_stats;
