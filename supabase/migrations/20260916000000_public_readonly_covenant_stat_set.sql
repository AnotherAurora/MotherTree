-- Public read-only access for covenant_stat_set, needed by the public Relic
-- Picker team-data builder (covenant sub-stat sets contribute base stats).
-- Mirrors the Search/Calculator allowlist pattern: anon SELECT only, soft-deleted
-- rows excluded. Admin service_role unchanged.

ALTER TABLE public.covenant_stat_set ENABLE ROW LEVEL SECURITY;

GRANT SELECT ON TABLE public.covenant_stat_set TO anon;

DROP POLICY IF EXISTS anon_select_alive ON public.covenant_stat_set;
CREATE POLICY anon_select_alive ON public.covenant_stat_set
  FOR SELECT TO anon
  USING (deleted_at IS NULL);
