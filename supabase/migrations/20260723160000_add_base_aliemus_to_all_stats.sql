ALTER TYPE public.all_stats ADD VALUE IF NOT EXISTS 'base_aliemus';

ALTER TABLE public.awakener
  ADD COLUMN IF NOT EXISTS base_aliemus double precision;
