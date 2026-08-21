-- unique_scaling local rows: target_type is inert in Path Carver math today;
-- scope is enforced by manifestation attachment. Normalize stored data to self.

UPDATE public.awakener_local_manifestation_interaction
SET target_type = 'self'::public.target_type,
    updated_at = now()
WHERE mode = 'unique_scaling'
  AND target_type IS DISTINCT FROM 'self';
