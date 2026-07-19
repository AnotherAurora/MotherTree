-- once_per_base: when true, apply once per matching subject base.
-- when false, team-once flat (e.g. Embryo Fusion → Aliemu once, then sum with other Aliemu bases).
ALTER TABLE public.tag_default_interaction
  ADD COLUMN IF NOT EXISTS once_per_base boolean NOT NULL DEFAULT true;

COMMENT ON COLUMN public.tag_default_interaction.once_per_base IS
  'When true, apply interaction once per matching subject base. When false, apply once for the team (team-once flat) without amplifying every target subject.';

-- Convert-into rows: Embryo Fusion should not amplify every Aliemu base.
UPDATE public.tag_default_interaction AS i
SET once_per_base = false
FROM public.tag AS modifier
WHERE i.modifier_tag_id = modifier.id
  AND i.deleted_at IS NULL
  AND modifier.deleted_at IS NULL
  AND modifier.tag_name = 'Support.Embryo Fusion';
