ALTER TABLE public.desire_anchored_awakener ENABLE ROW LEVEL SECURITY;

GRANT REFERENCES, TRIGGER, TRUNCATE, MAINTAIN ON TABLE public.desire_anchored_awakener TO anon;
GRANT REFERENCES, TRIGGER, TRUNCATE, MAINTAIN ON TABLE public.desire_anchored_awakener TO authenticated;
GRANT ALL ON TABLE public.desire_anchored_awakener TO service_role;

GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO service_role;
