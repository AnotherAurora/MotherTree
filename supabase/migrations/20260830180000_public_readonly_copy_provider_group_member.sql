-- Public Search: resolve copy_provider_group_id → member tag ids for hitCount.

ALTER TABLE public.copy_provider_group_member ENABLE ROW LEVEL SECURITY;

GRANT SELECT ON TABLE public.copy_provider_group_member TO anon;

DROP POLICY IF EXISTS anon_select_alive ON public.copy_provider_group_member;
CREATE POLICY anon_select_alive ON public.copy_provider_group_member
  FOR SELECT TO anon
  USING (deleted_at IS NULL);
