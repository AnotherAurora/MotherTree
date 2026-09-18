-- Special.Additional Team Max HP — dependency-scaled flat add to final team Max HP.
-- Unlike Defender.Max HP Up, this value is NOT multiplied by the Max HP Up bonus:
-- finalMaxHp = baseline + bonus(Max HP Up) + additional(dependency_stat-scaled).
INSERT INTO public.tag (
  tag_name,
  is_percent,
  is_additive,
  is_searchable,
  is_search_simulated,
  is_damage_relevant,
  damage_relevance_reason,
  created_at,
  updated_at
)
SELECT
  'Special.Additional Team Max HP',
  false,
  true,
  false,
  false,
  true,
  'seed',
  now(),
  now()
WHERE NOT EXISTS (
  SELECT 1 FROM public.tag
  WHERE tag_name = 'Special.Additional Team Max HP' AND deleted_at IS NULL
);

-- Repoint every live row on Special.Increase Base CON (184) to the new tag and
-- scale it by CON. Currently only Caraboo's two rows (3540 E0 / 3544 E3).
UPDATE public.awakener_tag_manifestation
SET
  tag_id = (
    SELECT id FROM public.tag
    WHERE tag_name = 'Special.Additional Team Max HP' AND deleted_at IS NULL
  ),
  dependency_stat = 'con',
  updated_at = now()
WHERE tag_id = 184
  AND deleted_at IS NULL;
