-- Phase 3a: expand awakener_local_manifestation_interaction for
-- unique_scaling / aftereffect (schema + backfill only; no engine change).

-- 1. Mode enum (no stored `override` mode).
CREATE TYPE public.awakener_local_interaction_mode AS ENUM (
  'unique_scaling',
  'aftereffect'
);

-- 2. New columns (nullable until backfill).
ALTER TABLE public.awakener_local_manifestation_interaction
  ADD COLUMN mode public.awakener_local_interaction_mode,
  ADD COLUMN layer public.layer,
  ADD COLUMN target_tag_id integer;

ALTER TABLE public.awakener_local_manifestation_interaction
  ADD CONSTRAINT awakener_local_manifestation_interaction_target_tag_id_fkey
  FOREIGN KEY (target_tag_id) REFERENCES public.tag (id) DEFERRABLE;

-- 3. Backfill existing rows → unique_scaling patch semantics.
UPDATE public.awakener_local_manifestation_interaction AS local
SET
  mode = 'unique_scaling',
  target_tag_id = NULL,
  target_type = COALESCE(local.target_type, 'aoe'::public.target_type),
  layer = COALESCE(
    local.layer,
    (SELECT t.layer FROM public.tag AS t WHERE t.id = local.modifier_tag_id)
  );

-- 4. Enforce mode + target_type.
ALTER TABLE public.awakener_local_manifestation_interaction
  ALTER COLUMN mode SET DEFAULT 'unique_scaling'::public.awakener_local_interaction_mode,
  ALTER COLUMN mode SET NOT NULL,
  ALTER COLUMN target_type SET DEFAULT 'aoe'::public.target_type,
  ALTER COLUMN target_type SET NOT NULL;

-- 5. Mode ↔ column nullability (unique_scaling: modifier required, target null;
--    aftereffect: target required, modifier null).
ALTER TABLE public.awakener_local_manifestation_interaction
  ADD CONSTRAINT awakener_local_manifestation_interaction_mode_columns_check
  CHECK (
    (
      mode = 'unique_scaling'
      AND modifier_tag_id IS NOT NULL
      AND target_tag_id IS NULL
    )
    OR (
      mode = 'aftereffect'
      AND modifier_tag_id IS NULL
      AND target_tag_id IS NOT NULL
    )
  );
