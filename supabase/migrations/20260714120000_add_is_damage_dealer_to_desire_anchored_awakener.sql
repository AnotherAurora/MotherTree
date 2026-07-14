ALTER TABLE public.desire_anchored_awakener
  ADD COLUMN IF NOT EXISTS is_damage_dealer boolean NOT NULL DEFAULT false;
