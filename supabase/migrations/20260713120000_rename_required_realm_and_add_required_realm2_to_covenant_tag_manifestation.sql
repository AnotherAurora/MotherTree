-- Rename only when the old column still exists (safe for remote + local)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'covenant_tag_manifestation'
      AND column_name = 'required_realm'
  ) THEN
    ALTER TABLE public.covenant_tag_manifestation
      RENAME COLUMN required_realm TO required_realm1;
  END IF;
END $$;

ALTER TABLE public.covenant_tag_manifestation
  ADD COLUMN IF NOT EXISTS required_realm2 public.realm;
