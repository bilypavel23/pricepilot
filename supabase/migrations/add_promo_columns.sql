-- Add optional promo code tracking columns to profiles table
-- These columns are optional - the API will work without them

-- Add promo_code column if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'profiles' 
    AND column_name = 'promo_code'
  ) THEN
    ALTER TABLE public.profiles 
    ADD COLUMN promo_code text null;
  END IF;
END $$;

-- Add promo_applied_at column if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'profiles' 
    AND column_name = 'promo_applied_at'
  ) THEN
    ALTER TABLE public.profiles 
    ADD COLUMN promo_applied_at timestamptz null;
  END IF;
END $$;


