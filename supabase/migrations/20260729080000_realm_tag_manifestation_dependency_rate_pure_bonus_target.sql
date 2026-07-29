CREATE TYPE public.pure_bonus_target AS ENUM (
  'none',
  'value_scalar',
  'dependency_rate'
);

ALTER TABLE public.realm_tag_manifestation
  ADD COLUMN IF NOT EXISTS dependency_rate double precision,
  ADD COLUMN IF NOT EXISTS pure_bonus_target public.pure_bonus_target NOT NULL DEFAULT 'none';

UPDATE public.realm_tag_manifestation
SET pure_bonus_target = 'value_scalar'
WHERE doubles_when_pure = true;

ALTER TABLE public.realm_tag_manifestation
  DROP COLUMN doubles_when_pure;
