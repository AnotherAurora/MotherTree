-- Keep the lowest id per (modifier_tag_id, target_tag_id, source_type) among active rows
DELETE FROM public.tag_default_interaction t
USING public.tag_default_interaction d
WHERE t.deleted_at IS NULL
  AND d.deleted_at IS NULL
  AND t.modifier_tag_id IS NOT DISTINCT FROM d.modifier_tag_id
  AND t.target_tag_id IS NOT DISTINCT FROM d.target_tag_id
  AND t.source_type IS NOT DISTINCT FROM d.source_type
  AND t.id > d.id;

CREATE UNIQUE INDEX tag_default_interaction_modifier_target_source_active_uniq
  ON public.tag_default_interaction (modifier_tag_id, target_tag_id, source_type)
  WHERE deleted_at IS NULL;
