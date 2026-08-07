-- Phase 2: public read-only access for the Search/Calculator allowlist.
-- SELECT for anon only; soft-deleted rows excluded. Admin service_role unchanged.

-- Ensure RLS is on (idempotent; already enabled on these tables).
ALTER TABLE public.realm ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.realm_tag_manifestation ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.covenant ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.covenant_tag_manifestation ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.awakener ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.awakener_tag_manifestation ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.awakener_local_manifestation_interaction ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.posse ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.posse_tag_manifestation ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wheel ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wheel_tag_manifestation ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tag ENABLE ROW LEVEL SECURITY;

GRANT SELECT ON TABLE public.realm TO anon;
GRANT SELECT ON TABLE public.realm_tag_manifestation TO anon;
GRANT SELECT ON TABLE public.covenant TO anon;
GRANT SELECT ON TABLE public.covenant_tag_manifestation TO anon;
GRANT SELECT ON TABLE public.awakener TO anon;
GRANT SELECT ON TABLE public.awakener_tag_manifestation TO anon;
GRANT SELECT ON TABLE public.awakener_local_manifestation_interaction TO anon;
GRANT SELECT ON TABLE public.posse TO anon;
GRANT SELECT ON TABLE public.posse_tag_manifestation TO anon;
GRANT SELECT ON TABLE public.wheel TO anon;
GRANT SELECT ON TABLE public.wheel_tag_manifestation TO anon;
GRANT SELECT ON TABLE public.tag TO anon;

DROP POLICY IF EXISTS anon_select_alive ON public.realm;
CREATE POLICY anon_select_alive ON public.realm
  FOR SELECT TO anon
  USING (deleted_at IS NULL);

DROP POLICY IF EXISTS anon_select_alive ON public.realm_tag_manifestation;
CREATE POLICY anon_select_alive ON public.realm_tag_manifestation
  FOR SELECT TO anon
  USING (deleted_at IS NULL);

DROP POLICY IF EXISTS anon_select_alive ON public.covenant;
CREATE POLICY anon_select_alive ON public.covenant
  FOR SELECT TO anon
  USING (deleted_at IS NULL);

DROP POLICY IF EXISTS anon_select_alive ON public.covenant_tag_manifestation;
CREATE POLICY anon_select_alive ON public.covenant_tag_manifestation
  FOR SELECT TO anon
  USING (deleted_at IS NULL);

DROP POLICY IF EXISTS anon_select_alive ON public.awakener;
CREATE POLICY anon_select_alive ON public.awakener
  FOR SELECT TO anon
  USING (deleted_at IS NULL);

DROP POLICY IF EXISTS anon_select_alive ON public.awakener_tag_manifestation;
CREATE POLICY anon_select_alive ON public.awakener_tag_manifestation
  FOR SELECT TO anon
  USING (deleted_at IS NULL);

DROP POLICY IF EXISTS anon_select_alive ON public.awakener_local_manifestation_interaction;
CREATE POLICY anon_select_alive ON public.awakener_local_manifestation_interaction
  FOR SELECT TO anon
  USING (deleted_at IS NULL);

DROP POLICY IF EXISTS anon_select_alive ON public.posse;
CREATE POLICY anon_select_alive ON public.posse
  FOR SELECT TO anon
  USING (deleted_at IS NULL);

DROP POLICY IF EXISTS anon_select_alive ON public.posse_tag_manifestation;
CREATE POLICY anon_select_alive ON public.posse_tag_manifestation
  FOR SELECT TO anon
  USING (deleted_at IS NULL);

DROP POLICY IF EXISTS anon_select_alive ON public.wheel;
CREATE POLICY anon_select_alive ON public.wheel
  FOR SELECT TO anon
  USING (deleted_at IS NULL);

DROP POLICY IF EXISTS anon_select_alive ON public.wheel_tag_manifestation;
CREATE POLICY anon_select_alive ON public.wheel_tag_manifestation
  FOR SELECT TO anon
  USING (deleted_at IS NULL);

DROP POLICY IF EXISTS anon_select_alive ON public.tag;
CREATE POLICY anon_select_alive ON public.tag
  FOR SELECT TO anon
  USING (deleted_at IS NULL);
