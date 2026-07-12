ALTER TABLE public.posse_tag_manifestation
  ADD COLUMN IF NOT EXISTS group_key character varying NOT NULL DEFAULT '1'::character varying;
