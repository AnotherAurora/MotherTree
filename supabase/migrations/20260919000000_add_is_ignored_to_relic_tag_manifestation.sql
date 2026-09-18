-- Add is_ignored to relic_tag_manifestation. Ignored rows are dropped from the
-- relic catalog at build time, so they contribute nothing to the damage engine
-- (and are hidden from the relic tooltip). This lets negligible relic effects be
-- folded away, collapsing many relics into identical effect sets.

ALTER TABLE public.relic_tag_manifestation
  ADD COLUMN IF NOT EXISTS is_ignored boolean NOT NULL DEFAULT false;
