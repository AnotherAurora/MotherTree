DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'manifestation_interaction_override'
      AND column_name = 'override_default_factor'
  ) THEN
    ALTER TABLE public.manifestation_interaction_override
      RENAME COLUMN override_default_factor TO value_scalar;
  END IF;
END $$;

COMMENT ON COLUMN public.manifestation_interaction_override.value_scalar IS
  'Scalar for this override link; scaled by dependency_stat when set (same role as manifestation value_scalar).';
