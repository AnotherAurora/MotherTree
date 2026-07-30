-- Rename substitute / once_per_base → creates_base / amplifies_subject.
-- Data maps 1:1 (create rows were substitute=true, once_per_base=false).

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'tag_default_interaction'
      AND column_name = 'substitute'
  ) THEN
    ALTER TABLE public.tag_default_interaction
      RENAME COLUMN substitute TO creates_base;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'tag_default_interaction'
      AND column_name = 'once_per_base'
  ) THEN
    ALTER TABLE public.tag_default_interaction
      RENAME COLUMN once_per_base TO amplifies_subject;
  END IF;
END $$;

ALTER TABLE public.tag_default_interaction
  ALTER COLUMN creates_base SET DEFAULT false;

ALTER TABLE public.tag_default_interaction
  ALTER COLUMN amplifies_subject SET DEFAULT true;

COMMENT ON COLUMN public.tag_default_interaction.creates_base IS
  'When true, modifier materializes target as a synthetic base (Phase 1). Intended with amplifies_subject=false.';

COMMENT ON COLUMN public.tag_default_interaction.amplifies_subject IS
  'When true, apply once per matching subject base (Phase 2). Intended with creates_base=false.';
