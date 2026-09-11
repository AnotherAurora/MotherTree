ALTER TABLE public.relic
  ADD COLUMN IF NOT EXISTS is_damage boolean NOT NULL DEFAULT true;
