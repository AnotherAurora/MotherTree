-- is_searchable: when true, this tag is eligible to appear on the public Search page.
ALTER TABLE public.tag
  ADD COLUMN IF NOT EXISTS is_searchable boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.tag.is_searchable IS
  'When true, this tag is eligible to appear on the public Search page.';
