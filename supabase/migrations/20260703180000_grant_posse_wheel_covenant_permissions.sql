ALTER TABLE public.posse ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.posse_tag_manifestation ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wheel ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wheel_tag_manifestation ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.covenant ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.covenant_tag_manifestation ENABLE ROW LEVEL SECURITY;

GRANT REFERENCES, TRIGGER, TRUNCATE, MAINTAIN ON TABLE public.posse TO anon;
GRANT REFERENCES, TRIGGER, TRUNCATE, MAINTAIN ON TABLE public.posse TO authenticated;
GRANT ALL ON TABLE public.posse TO service_role;

GRANT REFERENCES, TRIGGER, TRUNCATE, MAINTAIN ON TABLE public.posse_tag_manifestation TO anon;
GRANT REFERENCES, TRIGGER, TRUNCATE, MAINTAIN ON TABLE public.posse_tag_manifestation TO authenticated;
GRANT ALL ON TABLE public.posse_tag_manifestation TO service_role;

GRANT REFERENCES, TRIGGER, TRUNCATE, MAINTAIN ON TABLE public.wheel TO anon;
GRANT REFERENCES, TRIGGER, TRUNCATE, MAINTAIN ON TABLE public.wheel TO authenticated;
GRANT ALL ON TABLE public.wheel TO service_role;

GRANT REFERENCES, TRIGGER, TRUNCATE, MAINTAIN ON TABLE public.wheel_tag_manifestation TO anon;
GRANT REFERENCES, TRIGGER, TRUNCATE, MAINTAIN ON TABLE public.wheel_tag_manifestation TO authenticated;
GRANT ALL ON TABLE public.wheel_tag_manifestation TO service_role;

GRANT REFERENCES, TRIGGER, TRUNCATE, MAINTAIN ON TABLE public.covenant TO anon;
GRANT REFERENCES, TRIGGER, TRUNCATE, MAINTAIN ON TABLE public.covenant TO authenticated;
GRANT ALL ON TABLE public.covenant TO service_role;

GRANT REFERENCES, TRIGGER, TRUNCATE, MAINTAIN ON TABLE public.covenant_tag_manifestation TO anon;
GRANT REFERENCES, TRIGGER, TRUNCATE, MAINTAIN ON TABLE public.covenant_tag_manifestation TO authenticated;
GRANT ALL ON TABLE public.covenant_tag_manifestation TO service_role;

GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO service_role;
