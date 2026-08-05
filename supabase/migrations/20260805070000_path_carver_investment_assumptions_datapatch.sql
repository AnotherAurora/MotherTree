-- Path Carver investment assumptions bake-in (one-shot; re-running double-applies):
-- awakener skills lv6 + Soulforge lv10 → +30% ceil on con/atk/def
-- wheels +12 → SSR stat_amount × 2

UPDATE public.awakener
SET
  con = CASE WHEN con IS NOT NULL THEN CEIL(con * 1.3) ELSE con END,
  atk = CASE WHEN atk IS NOT NULL THEN CEIL(atk * 1.3) ELSE atk END,
  def = CASE WHEN def IS NOT NULL THEN CEIL(def * 1.3) ELSE def END,
  updated_at = NOW()
WHERE deleted_at IS NULL;

UPDATE public.wheel
SET
  stat_amount = stat_amount * 2,
  updated_at = NOW()
WHERE deleted_at IS NULL
  AND rarity = 'SSR'::public.rarity
  AND stat_amount IS NOT NULL;
