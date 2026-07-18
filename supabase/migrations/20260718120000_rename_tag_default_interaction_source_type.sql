DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'tag_default_interaction'
      AND column_name = 'source_type'
  ) THEN
    ALTER TABLE public.tag_default_interaction
      RENAME COLUMN source_type TO buff_target_type_restriction;
  END IF;
END $$;

DROP INDEX IF EXISTS public.tag_default_interaction_modifier_target_source_active_uniq;

CREATE UNIQUE INDEX tag_default_interaction_modifier_target_source_active_uniq
  ON public.tag_default_interaction
  USING btree (modifier_tag_id, target_tag_id, buff_target_type_restriction)
  WHERE (deleted_at IS NULL);
