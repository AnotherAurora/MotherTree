-- Phase 3e: Tentacle TDU pool replaces sequential TDU-family multiply onto
-- Attacker.Tentacle. Soft-delete TDI 3 / 75 / 77. Keep STR → Unique TDU invent
-- (16 / 76), Generate (91 / 92), and Vulnerability (73).

UPDATE public.tag_default_interaction AS tdi
SET
  deleted_at = now(),
  updated_at = now()
FROM public.tag AS mt,
     public.tag AS tt
WHERE tdi.modifier_tag_id = mt.id
  AND tdi.target_tag_id = tt.id
  AND tdi.deleted_at IS NULL
  AND tdi.creates_base = false
  AND tdi.amplifies_subject = true
  AND tt.tag_name = 'Attacker.Tentacle'
  AND mt.tag_name IN (
    'Support.Tentacle Damage Up',
    'Support.Unique Tentacle Damage Up',
    'Support.Tentacle Damage Up.Fixed'
  );
