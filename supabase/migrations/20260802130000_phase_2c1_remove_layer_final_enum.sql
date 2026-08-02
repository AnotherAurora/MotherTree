-- Phase 2c.1: remove leftover layer enum value `final` via recreate-type swap.
-- Inventory (implement-time): only public.tag.layer uses type public.layer.
-- No defaults, casts, views, or functions depend on layer.
-- Before/after counts (tag.layer, include nulls + soft-deleted):
--   null=73, pre_add=22, add=14, post_add=33, final=0; total=142 (unchanged).

-- 1. Datapatch: no rows may remain on final before the cast.
UPDATE public.tag
SET layer = 'post_add'
WHERE layer = 'final';

-- 2. Create three-value replacement type.
CREATE TYPE public.layer_new AS ENUM ('pre_add', 'add', 'post_add');

-- 3. Swap column (nulls pass through; labels match by name).
ALTER TABLE public.tag
  ALTER COLUMN layer TYPE public.layer_new
  USING layer::text::public.layer_new;

-- 4. Replace type name.
DROP TYPE public.layer;
ALTER TYPE public.layer_new RENAME TO layer;
