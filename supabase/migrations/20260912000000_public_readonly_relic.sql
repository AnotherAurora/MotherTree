-- Public read-only access for the relic catalog tables (Search/Calculator allowlist).
-- SELECT for anon only; soft-deleted rows excluded. Admin service_role unchanged.
-- Also trims over-granted privileges (TRUNCATE/REFERENCES/TRIGGER/MAINTAIN) added
-- by the original create_relic migrations so anon/authenticated stay SELECT-only.

ALTER TABLE public.relic ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.relic_tag_manifestation ENABLE ROW LEVEL SECURITY;

GRANT SELECT ON TABLE public.relic TO anon;
GRANT SELECT ON TABLE public.relic_tag_manifestation TO anon;

REVOKE TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public.relic FROM anon, authenticated;
REVOKE TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public.relic_tag_manifestation FROM anon, authenticated;

DROP POLICY IF EXISTS anon_select_alive ON public.relic;
CREATE POLICY anon_select_alive ON public.relic
  FOR SELECT TO anon
  USING (deleted_at IS NULL);

DROP POLICY IF EXISTS anon_select_alive ON public.relic_tag_manifestation;
CREATE POLICY anon_select_alive ON public.relic_tag_manifestation
  FOR SELECT TO anon
  USING (deleted_at IS NULL);
