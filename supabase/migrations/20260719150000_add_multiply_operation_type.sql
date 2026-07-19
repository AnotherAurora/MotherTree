-- Add multiply: same as multiply_one_plus but without the +1 on contribution.
ALTER TYPE public.operation_type ADD VALUE IF NOT EXISTS 'multiply';
