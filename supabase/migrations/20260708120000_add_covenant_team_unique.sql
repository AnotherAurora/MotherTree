ALTER TABLE public.covenant
  ADD COLUMN IF NOT EXISTS team_unique boolean NOT NULL DEFAULT false;
