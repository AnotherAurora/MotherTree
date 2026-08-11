-- Phase 4: public read-only access for tag_default_interaction (Search filter graph).
-- SELECT for anon only; soft-deleted rows excluded. Admin service_role unchanged.

ALTER TABLE public.tag_default_interaction ENABLE ROW LEVEL SECURITY;

GRANT SELECT ON TABLE public.tag_default_interaction TO anon;

DROP POLICY IF EXISTS anon_select_alive ON public.tag_default_interaction;
CREATE POLICY anon_select_alive ON public.tag_default_interaction
  FOR SELECT TO anon
  USING (deleted_at IS NULL);
