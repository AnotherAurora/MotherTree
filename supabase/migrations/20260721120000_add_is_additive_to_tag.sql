-- is_additive: how finished same-tag subject results combine after interaction passes.
-- true = sum; false = multiply (percent tags use (1+v) fold-back before product).
ALTER TABLE public.tag
  ADD COLUMN IF NOT EXISTS is_additive boolean NOT NULL DEFAULT true;

COMMENT ON COLUMN public.tag.is_additive IS
  'When true, post-pass same-tag results are summed. When false, they are multiplied (percent: product of (1+v)-1).';
