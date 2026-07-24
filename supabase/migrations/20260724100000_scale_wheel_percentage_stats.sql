UPDATE public.wheel
SET stat_amount = stat_amount / 100.0
WHERE stat IN (
  'crit_dmg',
  'crit_rate',
  'damage_amp',
  'sigil_yield',
  'death_resist'
);
