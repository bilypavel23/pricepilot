-- ============================================================================
-- Add competitor_price and related columns to competitor_product_matches
-- ============================================================================
-- This migration ensures competitor_product_matches has all required columns
-- for storing full competitor data (self-contained, no dependency on other tables)
-- ============================================================================

-- Add store_id if missing
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'competitor_product_matches' 
    AND column_name = 'store_id'
  ) THEN
    ALTER TABLE public.competitor_product_matches 
    ADD COLUMN store_id UUID REFERENCES public.stores(id) ON DELETE CASCADE;
    
    -- Create index
    CREATE INDEX IF NOT EXISTS idx_product_matches_store_id 
    ON public.competitor_product_matches(store_id);
  END IF;
END $$;

-- Add competitor_name if missing
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'competitor_product_matches' 
    AND column_name = 'competitor_name'
  ) THEN
    ALTER TABLE public.competitor_product_matches 
    ADD COLUMN competitor_name TEXT;
  END IF;
END $$;

-- Add competitor_url if missing
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'competitor_product_matches' 
    AND column_name = 'competitor_url'
  ) THEN
    ALTER TABLE public.competitor_product_matches 
    ADD COLUMN competitor_url TEXT;
  END IF;
END $$;

-- Add competitor_price if missing
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'competitor_product_matches' 
    AND column_name = 'competitor_price'
  ) THEN
    ALTER TABLE public.competitor_product_matches 
    ADD COLUMN competitor_price NUMERIC(10, 2);
  END IF;
END $$;

-- Add currency if missing
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'competitor_product_matches' 
    AND column_name = 'currency'
  ) THEN
    ALTER TABLE public.competitor_product_matches 
    ADD COLUMN currency TEXT DEFAULT 'USD';
  END IF;
END $$;

-- Add last_checked_at if missing
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'competitor_product_matches' 
    AND column_name = 'last_checked_at'
  ) THEN
    ALTER TABLE public.competitor_product_matches 
    ADD COLUMN last_checked_at TIMESTAMPTZ;
  END IF;
END $$;

-- Rename my_product_id to product_id if needed (for consistency)
DO $$ 
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'competitor_product_matches' 
    AND column_name = 'my_product_id'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'competitor_product_matches' 
    AND column_name = 'product_id'
  ) THEN
    ALTER TABLE public.competitor_product_matches 
    RENAME COLUMN my_product_id TO product_id;
  END IF;
END $$;

-- Rename competitor_store_id to competitor_id if needed (for consistency)
DO $$ 
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'competitor_product_matches' 
    AND column_name = 'competitor_store_id'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'competitor_product_matches' 
    AND column_name = 'competitor_id'
  ) THEN
    ALTER TABLE public.competitor_product_matches 
    RENAME COLUMN competitor_store_id TO competitor_id;
  END IF;
END $$;



