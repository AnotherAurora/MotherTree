-- Move the realm requirement from relic_tag_manifestation to the relic catalog.
-- Every relic row carries a single realm requirement, so the column belongs on
-- public.relic rather than on each relic–tag pairing.
-- relic_tag_manifestation has no non-null required_realm values, so the drop is lossless.

ALTER TABLE public.relic
  ADD COLUMN IF NOT EXISTS required_realm integer
  REFERENCES public.realm(id);

ALTER TABLE public.relic_tag_manifestation
  DROP COLUMN IF EXISTS required_realm;
