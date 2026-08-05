-- Phase 3a.1: allow unique_scaling with null modifier_tag_id when
-- dependency_stat supplies an awakener base-stat modifier; datapatch
-- Support.Stat Scaling placeholder rows to modifier_tag_id = null.

ALTER TABLE public.awakener_local_manifestation_interaction
  DROP CONSTRAINT awakener_local_manifestation_interaction_mode_columns_check;

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
  );

UPDATE public.awakener_local_manifestation_interaction AS ali
SET modifier_tag_id = NULL
FROM public.tag AS t
WHERE ali.modifier_tag_id = t.id
  AND t.tag_name = 'Support.Stat Scaling'
  AND ali.deleted_at IS NULL
  AND ali.mode = 'unique_scaling'
  AND ali.dependency_stat IS NOT NULL;
