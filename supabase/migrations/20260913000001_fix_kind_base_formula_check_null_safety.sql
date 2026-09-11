ALTER TABLE public.relic_tag_manifestation
  DROP CONSTRAINT IF EXISTS relic_tag_manifestation_base_formula_kind_check;

ALTER TABLE public.relic_tag_manifestation
  ADD CONSTRAINT relic_tag_manifestation_base_formula_kind_check
  CHECK (
    (kind = 'computed' AND COALESCE(base_formula IN ('esotericResearchDepth', 'occultResearchDepth', 'accountStageGrowth'), false))
    OR (kind = 'fixed' AND base_formula IS NULL)
  );