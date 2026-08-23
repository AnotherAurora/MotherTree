-- Phase 3g: remove leftover source_type enum value `tentacle` via recreate-type swap.
-- Inventory (implement-time): six columns use public.source_type. No defaults.
-- No views/functions/indexes depend on the type name after column swap.
-- Tentacle row counts (include soft-deleted): all 0.
-- ATM source_type: command card=71, exalt=63, rouse=22, talent=11, null=2, tentacle=0; total=169.
-- Datapatch policy: remaining 'tentacle' (if any) -> NULL.

-- 1. Datapatch: no rows may remain on tentacle before the cast.
UPDATE public.awakener_tag_manifestation
SET source_type = NULL
WHERE source_type = 'tentacle';

UPDATE public.awakener_tag_manifestation
SET buff_target_type_restriction = NULL
WHERE buff_target_type_restriction = 'tentacle';

UPDATE public.covenant_tag_manifestation
SET buff_target_type_restriction = NULL
WHERE buff_target_type_restriction = 'tentacle';

UPDATE public.posse_tag_manifestation
SET buff_target_type_restriction = NULL
WHERE buff_target_type_restriction = 'tentacle';

UPDATE public.wheel_tag_manifestation
SET buff_target_type_restriction = NULL
WHERE buff_target_type_restriction = 'tentacle';

UPDATE public.tag_default_interaction
SET buff_target_type_restriction = NULL
WHERE buff_target_type_restriction = 'tentacle';

-- 2. Create four-value replacement type.
CREATE TYPE public.source_type_new AS ENUM (
  'command card',
  'exalt',
  'rouse',
  'talent'
);

-- 3. Swap columns (nulls pass through; labels match by name).
ALTER TABLE public.awakener_tag_manifestation
  ALTER COLUMN source_type TYPE public.source_type_new
  USING source_type::text::public.source_type_new;

ALTER TABLE public.awakener_tag_manifestation
  ALTER COLUMN buff_target_type_restriction TYPE public.source_type_new
  USING buff_target_type_restriction::text::public.source_type_new;

ALTER TABLE public.covenant_tag_manifestation
  ALTER COLUMN buff_target_type_restriction TYPE public.source_type_new
  USING buff_target_type_restriction::text::public.source_type_new;

ALTER TABLE public.posse_tag_manifestation
  ALTER COLUMN buff_target_type_restriction TYPE public.source_type_new
  USING buff_target_type_restriction::text::public.source_type_new;

ALTER TABLE public.wheel_tag_manifestation
  ALTER COLUMN buff_target_type_restriction TYPE public.source_type_new
  USING buff_target_type_restriction::text::public.source_type_new;

ALTER TABLE public.tag_default_interaction
  ALTER COLUMN buff_target_type_restriction TYPE public.source_type_new
  USING buff_target_type_restriction::text::public.source_type_new;

-- 4. Replace type name.
ALTER TYPE public.source_type RENAME TO source_type_old;
ALTER TYPE public.source_type_new RENAME TO source_type;
DROP TYPE public.source_type_old;
