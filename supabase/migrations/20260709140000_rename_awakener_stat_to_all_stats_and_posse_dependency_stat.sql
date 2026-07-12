ALTER TYPE public.awakener_stat RENAME TO all_stats;

ALTER TYPE public.all_stats ADD VALUE IF NOT EXISTS 'team_max_hp';
ALTER TYPE public.all_stats ADD VALUE IF NOT EXISTS 'enemy_max_hp';

ALTER TABLE public.posse_tag_manifestation
  ADD COLUMN IF NOT EXISTS dependency_stat public.all_stats;
