-- The public read migrations granted anon SELECT; the offline sync script writes
-- with the service role, which needs DML on both tables plus the identity
-- sequence.

GRANT SELECT, INSERT, UPDATE, DELETE
  ON TABLE public.search_solo_totals TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE
  ON TABLE public.search_solo_totals_meta TO service_role;

GRANT USAGE, SELECT
  ON SEQUENCE public.search_solo_totals_id_seq TO service_role;
