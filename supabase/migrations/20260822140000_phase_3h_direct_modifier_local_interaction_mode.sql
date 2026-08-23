-- Phase 3h: add direct_modifier to public.awakener_local_interaction_mode
-- and update check constraint to allow direct_modifier mode rows
-- (target_tag_id IS NULL AND value_scalar IS NOT NULL).

ALTER TYPE public.awakener_local_interaction_mode ADD VALUE IF NOT EXISTS 'direct_modifier';

ALTER TABLE public.awakener_local_manifestation_interaction
  DROP CONSTRAINT IF EXISTS awakener_local_manifestation_interaction_mode_columns_check;

ALTER TABLE public.awakener_local_manifestation_interaction
  ADD CONSTRAINT awakener_local_manifestation_interaction_mode_columns_check
  CHECK (
    (
      mode = 'unique_scaling'::public.awakener_local_interaction_mode
      AND target_tag_id IS NULL
      AND (
        modifier_tag_id IS NOT NULL
        OR dependency_stat IS NOT NULL
      )
    )
    OR (
      mode = 'aftereffect'::public.awakener_local_interaction_mode
      AND modifier_tag_id IS NULL
      AND target_tag_id IS NOT NULL
    )
    OR (
      mode = 'direct_modifier'::public.awakener_local_interaction_mode
      AND target_tag_id IS NULL
      AND value_scalar IS NOT NULL
    )
  );
