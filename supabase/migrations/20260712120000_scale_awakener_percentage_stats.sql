UPDATE public.awakener
SET
  crit_dmg = crit_dmg / 100.0,
  crit_rate = crit_rate / 100.0,
  damage_amp = damage_amp / 100.0,
  sigil_yield = sigil_yield / 100.0,
  death_resist = death_resist / 100.0;
