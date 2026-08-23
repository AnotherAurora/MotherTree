-- Lemurian team synergy: Cause marker + tier When gates for Path Carver.
INSERT INTO public.tag (tag_name, is_percent, is_additive, is_searchable, created_at, updated_at)
SELECT 'Special.Cause.Lemurian', false, true, false, now(), now()
WHERE NOT EXISTS (
  SELECT 1 FROM public.tag
  WHERE tag_name = 'Special.Cause.Lemurian' AND deleted_at IS NULL
);

INSERT INTO public.tag (tag_name, is_percent, is_additive, is_searchable, created_at, updated_at)
SELECT 'Special.When.Lemurian Synergy 1', false, true, false, now(), now()
WHERE NOT EXISTS (
  SELECT 1 FROM public.tag
  WHERE tag_name = 'Special.When.Lemurian Synergy 1' AND deleted_at IS NULL
);

INSERT INTO public.tag (tag_name, is_percent, is_additive, is_searchable, created_at, updated_at)
SELECT 'Special.When.Lemurian Synergy 2', false, true, false, now(), now()
WHERE NOT EXISTS (
  SELECT 1 FROM public.tag
  WHERE tag_name = 'Special.When.Lemurian Synergy 2' AND deleted_at IS NULL
);

INSERT INTO public.tag (tag_name, is_percent, is_additive, is_searchable, created_at, updated_at)
SELECT 'Special.When.Lemurian Synergy 3', false, true, false, now(), now()
WHERE NOT EXISTS (
  SELECT 1 FROM public.tag
  WHERE tag_name = 'Special.When.Lemurian Synergy 3' AND deleted_at IS NULL
);
