ALTER TABLE public.relic_tag_manifestation
  ADD COLUMN IF NOT EXISTS kind text NOT NULL DEFAULT 'fixed',
  ADD COLUMN IF NOT EXISTS base_formula text;

ALTER TABLE public.relic_tag_manifestation
  ADD CONSTRAINT relic_tag_manifestation_kind_check
  CHECK (kind IN ('fixed', 'computed'));

ALTER TABLE public.relic_tag_manifestation
  ADD CONSTRAINT relic_tag_manifestation_base_formula_kind_check
  CHECK (
    (kind = 'computed' AND COALESCE(base_formula IN ('esotericResearchDepth', 'occultResearchDepth', 'accountStageGrowth'), false))
    OR (kind = 'fixed' AND base_formula IS NULL)
  );