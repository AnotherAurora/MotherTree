-- Add notes column to awakener table for kit scratchpad / notes.
ALTER TABLE public.awakener
  ADD COLUMN IF NOT EXISTS notes text;

COMMENT ON COLUMN public.awakener.notes IS
  'Scratchpad notes regarding the awakener kit, mechanics, rotations, or reminders.';
