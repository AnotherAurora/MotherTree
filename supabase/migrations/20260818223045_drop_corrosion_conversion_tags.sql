-- Soft-delete obsolete Special.* Conversion tags if they were ever inserted.
-- Corrosion / Ancient Embers now use tag_default_interaction add_scaled ×3
-- (TDI 111 / 112). Do not touch those rows or the debuff/damage tags.

UPDATE public.tag
SET deleted_at = now(), updated_at = now()
WHERE tag_name IN (
  'Special.Corrosion Conversion',
  'Special.Ancient Embers Conversion'
)
AND deleted_at IS NULL;
