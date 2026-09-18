-- Soft-delete the redundant Support.Take Effect Again -> Attacker.Active Damage
-- modifier (TDI 56). The tag is already a command-card copy-provider member
-- (copy_provider_group_member), so the multiply_one_plus row double-counted the
-- same effect and made Stellar Brew hugely outrank Jade Imprint / Mute Jukebox.
-- Copy-provider semantics are the single source of truth for this tag now.

UPDATE public.tag_default_interaction
SET deleted_at = now(), updated_at = now()
WHERE modifier_tag_id = (
    SELECT id FROM public.tag
    WHERE tag_name = 'Support.Take Effect Again' AND deleted_at IS NULL
  )
  AND target_tag_id = (
    SELECT id FROM public.tag
    WHERE tag_name = 'Attacker.Active Damage' AND deleted_at IS NULL
  )
  AND buff_target_type_restriction = 'command card'
  AND deleted_at IS NULL;
