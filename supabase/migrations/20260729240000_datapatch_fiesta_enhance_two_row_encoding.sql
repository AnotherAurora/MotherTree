-- Convert Fiesta/Enhance single-row rate encoding to two-row additive form:
-- base flat + (base * 0.0005) * realm_mastery, pure doubles the RM row.

UPDATE public.realm_tag_manifestation
SET
  dependency_stat = NULL,
  dependency_rate = NULL,
  dependency_rate_stat = NULL,
  pure_bonus_target = 'none'
WHERE id IN (19, 22, 48, 49);

INSERT INTO public.realm_tag_manifestation (
  realm_id,
  tag_id,
  value_scalar,
  dependency_stat,
  dependency_rate,
  dependency_rate_stat,
  pure_bonus_target,
  required_realm_mode,
  trigger_condition,
  is_accumulating,
  is_permanent,
  metadata
) VALUES
  (3, 69, 0.01, 'realm_mastery', NULL, NULL, 'value_scalar', 'present', NULL, false, false, NULL),
  (3, 69, 0.02, 'realm_mastery', NULL, NULL, 'value_scalar', 'present', NULL, false, false, NULL),
  (7, 68, 0.0075, 'realm_mastery', NULL, NULL, 'value_scalar', 'present', NULL, false, false, NULL),
  (7, 68, 0.0125, 'realm_mastery', NULL, NULL, 'value_scalar', 'present', NULL, false, false, 'Doesn''t show it is first card only');
