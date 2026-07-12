ALTER TABLE public.posse_tag_manifestation
  ADD COLUMN math_operation public.operation_type DEFAULT 'add_to_base_value'::public.operation_type;
