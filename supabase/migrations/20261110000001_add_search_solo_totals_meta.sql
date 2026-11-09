-- Sync marker for public.search_solo_totals.
--
-- Row presence alone cannot tell "not synced yet" from "this tag legitimately
-- contributes nothing at this enlightenment" (e.g. E0 gating). The sync script
-- records which tag ids were included, so Search can flag a tag that was
-- flagged `is_search_simulated` after the last sync.

CREATE TABLE IF NOT EXISTS public.search_solo_totals_meta (
  id boolean PRIMARY KEY DEFAULT true CHECK (id),
  synced_at timestamptz NOT NULL DEFAULT now(),
  tag_ids integer[] NOT NULL DEFAULT '{}'
);

INSERT INTO public.search_solo_totals_meta (id)
VALUES (true)
ON CONFLICT (id) DO NOTHING;

COMMENT ON TABLE public.search_solo_totals_meta IS
  'Single-row sync marker for public.search_solo_totals.';

ALTER TABLE public.search_solo_totals_meta ENABLE ROW LEVEL SECURITY;

GRANT SELECT ON TABLE public.search_solo_totals_meta TO anon;

DROP POLICY IF EXISTS anon_select_alive ON public.search_solo_totals_meta;
CREATE POLICY anon_select_alive ON public.search_solo_totals_meta
  FOR SELECT TO anon
  USING (true);
