-- Rework operation_type enum + add tag.is_percent.
-- Postgres cannot drop enum labels; rebuild via text CASE remap.

-- 1) Soft-delete Corrosion / Ancient Embers interaction rows
UPDATE public.tag_default_interaction
SET deleted_at = now(), updated_at = now()
WHERE id IN (18, 19, 20, 21, 58, 59, 60, 61)
  AND deleted_at IS NULL;

-- 2) Drop defaults that reference old enum labels (row data untouched)
ALTER TABLE public.posse_tag_manifestation
  ALTER COLUMN math_operation DROP DEFAULT;

ALTER TABLE public.tag_default_interaction
  ALTER COLUMN math_operation DROP DEFAULT;

-- 3) New enum type
CREATE TYPE public.operation_type_new AS ENUM (
  'presence_multiply',
  'add_scaled',
  'multiply_one_plus'
);

-- 4) Remap columns: old enum → text → CASE → new enum
ALTER TABLE public.tag_default_interaction
  ALTER COLUMN math_operation TYPE public.operation_type_new
  USING (
    CASE math_operation::text
      WHEN 'add_to_base_value' THEN 'add_scaled'
      WHEN 'compound_multiplier' THEN 'multiply_one_plus'
      WHEN 'add_to_multiplier' THEN 'multiply_one_plus'
      WHEN 'add_hits' THEN 'add_scaled'
      WHEN 'subtract' THEN 'add_scaled'
    END
  )::public.operation_type_new;

ALTER TABLE public.manifestation_interaction_override
  ALTER COLUMN math_operation TYPE public.operation_type_new
  USING (
    CASE
      WHEN math_operation IS NULL THEN NULL
      ELSE (
        CASE math_operation::text
          WHEN 'add_to_base_value' THEN 'add_scaled'
          WHEN 'compound_multiplier' THEN 'multiply_one_plus'
          WHEN 'add_to_multiplier' THEN 'multiply_one_plus'
          WHEN 'add_hits' THEN 'add_scaled'
          WHEN 'subtract' THEN 'add_scaled'
        END
      )::public.operation_type_new
    END
  );

ALTER TABLE public.posse_tag_manifestation
  ALTER COLUMN math_operation TYPE public.operation_type_new
  USING (
    CASE math_operation::text
      WHEN 'add_to_base_value' THEN 'add_scaled'
      WHEN 'compound_multiplier' THEN 'multiply_one_plus'
      WHEN 'add_to_multiplier' THEN 'multiply_one_plus'
      WHEN 'add_hits' THEN 'add_scaled'
      WHEN 'subtract' THEN 'add_scaled'
    END
  )::public.operation_type_new;

-- 5) Only Support.Debuff.Vulnerability (interaction id 1) is presence_multiply
UPDATE public.tag_default_interaction
SET math_operation = 'presence_multiply'
WHERE id = 1;

-- 6) Swap types
DROP TYPE public.operation_type;
ALTER TYPE public.operation_type_new RENAME TO operation_type;

-- 7) Restore defaults on the new type
ALTER TABLE public.posse_tag_manifestation
  ALTER COLUMN math_operation SET DEFAULT 'add_scaled'::public.operation_type;

ALTER TABLE public.tag_default_interaction
  ALTER COLUMN math_operation SET DEFAULT 'multiply_one_plus'::public.operation_type;

-- tag.is_percent
ALTER TABLE public.tag
  ADD COLUMN IF NOT EXISTS is_percent boolean NOT NULL DEFAULT false;

UPDATE public.tag
SET is_percent = true
WHERE deleted_at IS NULL
  AND (
    tag_name = 'Support.Aliemu'
    OR tag_name = 'Support.Embryo Fusion'
    OR tag_name = 'Support.Fiamma'
    OR tag_name = 'Support.Propagation Fiesta'
    OR tag_name = 'Support.Take Effect Again'
    OR tag_name = 'Support.Final Damage'
    OR tag_name LIKE 'Support.Final Damage.%'
    OR tag_name = 'Support.Enhance'
    OR tag_name LIKE 'Support.Enhance.%'
    OR tag_name = 'Support.Increase Gain'
    OR tag_name LIKE 'Support.Increase Gain.%'
    OR tag_name = 'Support.Crit Damage'
    OR tag_name LIKE 'Support.Crit Damage.%'
    OR tag_name = 'Support.Crit Rate'
    OR tag_name LIKE 'Support.Crit Rate.%'
    OR tag_name = 'Support.Damage AMP'
    OR tag_name LIKE 'Support.Damage AMP.%'
    OR tag_name = 'Support.Base Damage'
    OR tag_name LIKE 'Support.Base Damage.%'
  );

-- Special conversion tags (engine-hardcoded later)
INSERT INTO public.tag (tag_name, created_at, updated_at)
SELECT 'Special.Corrosion Conversion', now(), now()
WHERE NOT EXISTS (
  SELECT 1 FROM public.tag
  WHERE tag_name = 'Special.Corrosion Conversion' AND deleted_at IS NULL
);

INSERT INTO public.tag (tag_name, created_at, updated_at)
SELECT 'Special.Ancient Embers Conversion', now(), now()
WHERE NOT EXISTS (
  SELECT 1 FROM public.tag
  WHERE tag_name = 'Special.Ancient Embers Conversion' AND deleted_at IS NULL
);
