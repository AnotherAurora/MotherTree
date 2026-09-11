CREATE TYPE public.relic_arg_kind AS ENUM ('fixed', 'computed');
CREATE TYPE public.relic_base_formula AS ENUM ('esotericResearchDepth', 'occultResearchDepth', 'accountStageGrowth');

ALTER TABLE public.relic_tag_manifestation
  DROP CONSTRAINT IF EXISTS relic_tag_manifestation_kind_check;

ALTER TABLE public.relic_tag_manifestation
  DROP CONSTRAINT IF EXISTS relic_tag_manifestation_base_formula_kind_check;

ALTER TABLE public.relic_tag_manifestation
  ALTER COLUMN kind DROP DEFAULT;

ALTER TABLE public.relic_tag_manifestation
  ALTER COLUMN kind TYPE public.relic_arg_kind USING kind::public.relic_arg_kind,
  ALTER COLUMN base_formula TYPE public.relic_base_formula USING base_formula::public.relic_base_formula;

ALTER TABLE public.relic_tag_manifestation
  ALTER COLUMN kind SET DEFAULT 'fixed'::public.relic_arg_kind;

ALTER TABLE public.relic_tag_manifestation
  ADD CONSTRAINT relic_tag_manifestation_base_formula_kind_check
  CHECK (
    (kind = 'computed'::public.relic_arg_kind AND COALESCE(base_formula IN ('esotericResearchDepth'::public.relic_base_formula, 'occultResearchDepth'::public.relic_base_formula, 'accountStageGrowth'::public.relic_base_formula), false))
    OR (kind = 'fixed'::public.relic_arg_kind AND base_formula IS NULL)
  );