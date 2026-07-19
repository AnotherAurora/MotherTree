-- substitute: when true, modifier may synthesize target from 0 (e.g. Fiamma → Final Damage).
-- when false, target must be Layer A base-present (e.g. Increase Gain.STR Up → STR Up).
ALTER TABLE public.tag_default_interaction
  ADD COLUMN IF NOT EXISTS substitute boolean NOT NULL DEFAULT true;

COMMENT ON COLUMN public.tag_default_interaction.substitute IS
  'When true, allow applying even if target tag has no Layer A base (synthesize). When false, require target base-present. Ignored for Attacker.*/Defender.* sinks which always require base.';

-- Amplify-only Increase Gain rows should not invent missing buff targets.
UPDATE public.tag_default_interaction AS i
SET substitute = false
FROM public.tag AS modifier
WHERE i.modifier_tag_id = modifier.id
  AND i.deleted_at IS NULL
  AND modifier.deleted_at IS NULL
  AND modifier.tag_name LIKE 'Support.Increase Gain.%';
