-- Kit Reader: pending vs live ATM rows.
-- verified=false = pending (admin review); live loaders + anon RLS require true.
-- Locals inherit via parent ATM (no separate verified column).

ALTER TABLE public.awakener_tag_manifestation
  ADD COLUMN IF NOT EXISTS verified boolean NOT NULL DEFAULT true;

COMMENT ON COLUMN public.awakener_tag_manifestation.verified IS
  'false = Kit Reader pending; true = live for Path Carver / Search / Simulator. Insert CLI always false; manual creates default true.';

-- Backfill (default already true for existing rows; explicit for clarity)
UPDATE public.awakener_tag_manifestation
SET verified = true
WHERE verified IS DISTINCT FROM true;

-- Anon must not see pending ATMs
DROP POLICY IF EXISTS anon_select_alive ON public.awakener_tag_manifestation;
CREATE POLICY anon_select_alive ON public.awakener_tag_manifestation
  FOR SELECT TO anon
  USING (deleted_at IS NULL AND verified = true);

-- Locals: only when parent ATM is verified (or orphan null parent — rare)
DROP POLICY IF EXISTS anon_select_alive ON public.awakener_local_manifestation_interaction;
CREATE POLICY anon_select_alive ON public.awakener_local_manifestation_interaction
  FOR SELECT TO anon
  USING (
    deleted_at IS NULL
    AND (
      manifestation_id IS NULL
      OR EXISTS (
        SELECT 1
        FROM public.awakener_tag_manifestation atm
        WHERE atm.id = manifestation_id
          AND atm.deleted_at IS NULL
          AND atm.verified = true
      )
    )
  );
