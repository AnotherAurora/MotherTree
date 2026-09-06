-- is_search_simulated: routes how a tag's awakener rows are produced on the
-- public Search page. When true, the tag's awakener rows come from the
-- solo-simulation aggregate (one row per awakener). When false (default), the
-- awakener rows come from direct per-manifestation rows, exactly like Support.*.
-- Tag name prefix no longer decides simulation; this flag does.
ALTER TABLE public.tag
  ADD COLUMN IF NOT EXISTS is_search_simulated boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.tag.is_search_simulated IS
  'When true, this tag''s awakener Search rows come from the solo-simulation aggregate (one row per awakener); when false, from direct per-manifestation rows (like Support).';

-- Backfill: all current Attacker.*/Defender.* descendants (including deep
-- leaves) run the solo simulation, preserving existing Search behavior.
-- Support.* and Special.* stay false.
UPDATE public.tag
  SET is_search_simulated = true
  WHERE (tag_name LIKE 'Attacker.%' OR tag_name LIKE 'Defender.%')
    AND is_search_simulated = false;
