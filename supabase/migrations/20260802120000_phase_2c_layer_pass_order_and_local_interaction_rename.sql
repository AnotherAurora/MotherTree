-- Phase 2c: datapatch f→z, rename layer enum values, rename local interaction table.

-- 1. Datapatch: move all tags off f onto z (include soft-deleted).
UPDATE public.tag
SET layer = 'z'
WHERE layer = 'f';

-- 2. Enum rename in place (no recreate; no further column rewrite).
ALTER TYPE public.layer RENAME VALUE 'x' TO 'pre_add';
ALTER TYPE public.layer RENAME VALUE 'y' TO 'add';
ALTER TYPE public.layer RENAME VALUE 'z' TO 'post_add';
ALTER TYPE public.layer RENAME VALUE 'f' TO 'final';

-- 3. Table rename (constraints/grants follow the table).
ALTER TABLE public.manifestation_interaction_override
  RENAME TO awakener_local_manifestation_interaction;
