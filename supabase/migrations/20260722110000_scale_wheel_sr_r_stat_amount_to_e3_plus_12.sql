UPDATE public.wheel
SET stat_amount = CASE
  WHEN rarity = 'SR' THEN stat_amount * 2
  WHEN rarity = 'R'  THEN stat_amount * 3
END
WHERE rarity IN ('SR', 'R');
