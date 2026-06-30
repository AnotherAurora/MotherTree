UPDATE public.awakener_tag_manifestation
SET required_enlightenment = 0
WHERE required_enlightenment IS NULL;

ALTER TABLE public.awakener_tag_manifestation
  ALTER COLUMN required_enlightenment SET DEFAULT 0;
