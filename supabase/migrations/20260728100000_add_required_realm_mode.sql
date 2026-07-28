-- Realm match mode for realm_tag_manifestation only.
-- Other manifestation tables keep the hardcoded chaos-only required_realm rule.

CREATE TYPE public.realm_match_mode AS ENUM ('present', 'exclusive');

ALTER TABLE public.realm_tag_manifestation
  ADD COLUMN required_realm_mode public.realm_match_mode NOT NULL DEFAULT 'present';

UPDATE public.realm_tag_manifestation
SET required_realm_mode = 'exclusive'
WHERE realm_id = (SELECT id FROM public.realm WHERE name = 'chaos');
