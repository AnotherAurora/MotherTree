-- Consolidate Attacker.Active Damage.Fixed Damage.Max HP into
-- Attacker.Active Damage.Fixed Damage, update all FK references and metadata,
-- then soft-delete the obsolete tag.

DO $$
DECLARE
  old_id integer;
  new_id integer;
BEGIN
  SELECT id INTO old_id
  FROM public.tag
  WHERE tag_name = 'Attacker.Active Damage.Fixed Damage.Max HP'
    AND deleted_at IS NULL;

  SELECT id INTO new_id
  FROM public.tag
  WHERE tag_name = 'Attacker.Active Damage.Fixed Damage'
    AND deleted_at IS NULL;

  IF old_id IS NULL THEN
    RAISE NOTICE 'Tag Attacker.Active Damage.Fixed Damage.Max HP not found or already deleted; skipping retag.';
    RETURN;
  END IF;

  IF new_id IS NULL THEN
    RAISE EXCEPTION 'Target tag Attacker.Active Damage.Fixed Damage not found.';
  END IF;

  -- 1. copy_provider_group_member: resolve potential unique index conflicts
  UPDATE public.copy_provider_group_member
  SET deleted_at = now(), updated_at = now()
  WHERE tag_id = old_id
    AND deleted_at IS NULL
    AND group_id IN (
      SELECT group_id
      FROM public.copy_provider_group_member
      WHERE tag_id = new_id
        AND deleted_at IS NULL
    );

  UPDATE public.copy_provider_group_member
  SET tag_id = new_id, updated_at = now()
  WHERE tag_id = old_id;

  -- 2. tag_default_interaction: resolve potential unique index conflicts before retagging
  UPDATE public.tag_default_interaction AS old_tdi
  SET deleted_at = now(), updated_at = now()
  WHERE old_tdi.deleted_at IS NULL
    AND (old_tdi.modifier_tag_id = old_id OR old_tdi.target_tag_id = old_id)
    AND EXISTS (
      SELECT 1
      FROM public.tag_default_interaction AS existing
      WHERE existing.deleted_at IS NULL
        AND existing.id <> old_tdi.id
        AND existing.modifier_tag_id = CASE WHEN old_tdi.modifier_tag_id = old_id THEN new_id ELSE old_tdi.modifier_tag_id END
        AND existing.target_tag_id = CASE WHEN old_tdi.target_tag_id = old_id THEN new_id ELSE old_tdi.target_tag_id END
        AND existing.buff_target_type_restriction IS NOT DISTINCT FROM old_tdi.buff_target_type_restriction
    );

  UPDATE public.tag_default_interaction
  SET modifier_tag_id = new_id, updated_at = now()
  WHERE modifier_tag_id = old_id;

  UPDATE public.tag_default_interaction
  SET target_tag_id = new_id, updated_at = now()
  WHERE target_tag_id = old_id;

  UPDATE public.tag_default_interaction
  SET exclusion_suffix = new_id, updated_at = now()
  WHERE exclusion_suffix = old_id;

  -- 3. Retag manifestation tables & local interactions
  UPDATE public.awakener_tag_manifestation
  SET tag_id = new_id, updated_at = now()
  WHERE tag_id = old_id;

  UPDATE public.awakener_local_manifestation_interaction
  SET modifier_tag_id = new_id, updated_at = now()
  WHERE modifier_tag_id = old_id;

  UPDATE public.awakener_local_manifestation_interaction
  SET target_tag_id = new_id, updated_at = now()
  WHERE target_tag_id = old_id;

  UPDATE public.covenant_tag_manifestation
  SET tag_id = new_id, updated_at = now()
  WHERE tag_id = old_id;

  UPDATE public.posse_tag_manifestation
  SET tag_id = new_id, updated_at = now()
  WHERE tag_id = old_id;

  UPDATE public.realm_tag_manifestation
  SET tag_id = new_id, updated_at = now()
  WHERE tag_id = old_id;

  UPDATE public.wheel_tag_manifestation
  SET tag_id = new_id, updated_at = now()
  WHERE tag_id = old_id;

  UPDATE public.desire_demand
  SET tag_id = new_id
  WHERE tag_id = old_id;

  -- 4. Refresh metadata strings on Fixed Damage ATMs
  UPDATE public.awakener_tag_manifestation
  SET metadata = REPLACE(metadata, 'Active Damage.Fixed Damage.Max HP', 'Active Damage.Fixed Damage'),
      updated_at = now()
  WHERE tag_id = new_id
    AND metadata LIKE '%Active Damage.Fixed Damage.Max HP%';

  UPDATE public.awakener_tag_manifestation
  SET metadata = REPLACE(metadata, 'Max HP Damage', 'Fixed Damage'),
      updated_at = now()
  WHERE tag_id = new_id
    AND metadata LIKE '%Max HP Damage%';

  UPDATE public.covenant_tag_manifestation
  SET metadata = REPLACE(metadata, 'Active Damage.Fixed Damage.Max HP', 'Active Damage.Fixed Damage'),
      updated_at = now()
  WHERE tag_id = new_id
    AND metadata LIKE '%Active Damage.Fixed Damage.Max HP%';

  UPDATE public.posse_tag_manifestation
  SET metadata = REPLACE(metadata, 'Active Damage.Fixed Damage.Max HP', 'Active Damage.Fixed Damage'),
      updated_at = now()
  WHERE tag_id = new_id
    AND metadata LIKE '%Active Damage.Fixed Damage.Max HP%';

  UPDATE public.realm_tag_manifestation
  SET metadata = REPLACE(metadata, 'Active Damage.Fixed Damage.Max HP', 'Active Damage.Fixed Damage'),
      updated_at = now()
  WHERE tag_id = new_id
    AND metadata LIKE '%Active Damage.Fixed Damage.Max HP%';

  UPDATE public.wheel_tag_manifestation
  SET metadata = REPLACE(metadata, 'Active Damage.Fixed Damage.Max HP', 'Active Damage.Fixed Damage'),
      updated_at = now()
  WHERE tag_id = new_id
    AND metadata LIKE '%Active Damage.Fixed Damage.Max HP%';

  -- 5. Soft-delete the obsolete tag
  UPDATE public.tag
  SET deleted_at = now(), updated_at = now()
  WHERE id = old_id
    AND deleted_at IS NULL;
END $$;
