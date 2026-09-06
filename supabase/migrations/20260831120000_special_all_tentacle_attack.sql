-- Special.All Tentacle Attack — marker tag + Faros/Murphy carrier migration (hop 4f).
INSERT INTO public.tag (tag_name, is_percent, is_additive, is_searchable, created_at, updated_at)
SELECT 'Special.All Tentacle Attack', false, true, false, now(), now()
WHERE NOT EXISTS (
  SELECT 1 FROM public.tag
  WHERE tag_name = 'Special.All Tentacle Attack' AND deleted_at IS NULL
);

-- Retire Generate unique_scaling locals on zero-base Tentacle carriers.
UPDATE public.awakener_local_manifestation_interaction
SET deleted_at = now(), updated_at = now()
WHERE id IN (87, 88, 321, 322)
  AND deleted_at IS NULL;

UPDATE public.awakener_tag_manifestation
SET deleted_at = now(), updated_at = now()
WHERE id IN (567, 1948)
  AND deleted_at IS NULL;

-- Faros SF Tentacle (awakener_id 19).
INSERT INTO public.awakener_tag_manifestation (
  awakener_id,
  tag_id,
  value_scalar,
  source_type,
  target_type,
  verified,
  metadata,
  instance_count,
  base_copies,
  is_accumulating,
  created_at,
  updated_at
)
SELECT
  19,
  t.id,
  1,
  'talent',
  'single',
  true,
  'SF Tentacle',
  1,
  1,
  false,
  now(),
  now()
FROM public.tag t
WHERE t.tag_name = 'Special.All Tentacle Attack'
  AND t.deleted_at IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.awakener_tag_manifestation a
    WHERE a.awakener_id = 19
      AND a.tag_id = t.id
      AND a.deleted_at IS NULL
      AND a.metadata = 'SF Tentacle'
  );

-- Murphy Exalt Tentacle (awakener_id 36).
INSERT INTO public.awakener_tag_manifestation (
  awakener_id,
  tag_id,
  value_scalar,
  source_type,
  target_type,
  verified,
  metadata,
  instance_count,
  base_copies,
  is_accumulating,
  created_at,
  updated_at
)
SELECT
  36,
  t.id,
  1,
  'exalt',
  'single',
  false,
  'Exalt Tentacle',
  1,
  1,
  false,
  now(),
  now()
FROM public.tag t
WHERE t.tag_name = 'Special.All Tentacle Attack'
  AND t.deleted_at IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.awakener_tag_manifestation a
    WHERE a.awakener_id = 36
      AND a.tag_id = t.id
      AND a.deleted_at IS NULL
      AND a.metadata = 'Exalt Tentacle'
  );
