-- ============================================================================
-- Fix unique constraint for competitor_url_products
-- ============================================================================
-- This migration ensures the unique constraint matches the upsert onConflict:
-- UNIQUE (store_id, product_id, competitor_url)
-- ============================================================================

-- Drop existing UNIQUE constraints on competitor_url_products if they don't match
DO $$ 
BEGIN
  -- Drop constraint if it exists with different columns
  IF EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conrelid = 'public.competitor_url_products'::regclass 
    AND conname LIKE '%unique%'
    AND conname != 'competitor_url_products_store_id_product_id_competitor_url_key'
  ) THEN
    -- Find and drop old unique constraints
    EXECUTE (
      SELECT string_agg('ALTER TABLE public.competitor_url_products DROP CONSTRAINT IF EXISTS ' || quote_ident(conname) || ';', ' ')
      FROM pg_constraint
      WHERE conrelid = 'public.competitor_url_products'::regclass
      AND contype = 'u'
      AND conname != 'competitor_url_products_store_id_product_id_competitor_url_key'
    );
  END IF;
END $$;

-- Ensure columns exist
DO $$ 
BEGIN
  -- Add store_id if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'competitor_url_products' 
    AND column_name = 'store_id'
  ) THEN
    ALTER TABLE public.competitor_url_products 
    ADD COLUMN store_id UUID REFERENCES public.stores(id) ON DELETE CASCADE;
  END IF;

  -- Add product_id if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'competitor_url_products' 
    AND column_name = 'product_id'
  ) THEN
    ALTER TABLE public.competitor_url_products 
    ADD COLUMN product_id UUID REFERENCES public.products(id) ON DELETE CASCADE;
  END IF;

  -- Add competitor_url if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'competitor_url_products' 
    AND column_name = 'competitor_url'
  ) THEN
    ALTER TABLE public.competitor_url_products 
    ADD COLUMN competitor_url TEXT;
  END IF;

  -- Add competitor_name if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'competitor_url_products' 
    AND column_name = 'competitor_name'
  ) THEN
    ALTER TABLE public.competitor_url_products 
    ADD COLUMN competitor_name TEXT;
  END IF;

  -- Add last_price if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'competitor_url_products' 
    AND column_name = 'last_price'
  ) THEN
    ALTER TABLE public.competitor_url_products 
    ADD COLUMN last_price NUMERIC(10, 2);
  END IF;

  -- Add currency if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'competitor_url_products' 
    AND column_name = 'currency'
  ) THEN
    ALTER TABLE public.competitor_url_products 
    ADD COLUMN currency TEXT DEFAULT 'USD';
  END IF;

  -- Add last_checked_at if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'competitor_url_products' 
    AND column_name = 'last_checked_at'
  ) THEN
    ALTER TABLE public.competitor_url_products 
    ADD COLUMN last_checked_at TIMESTAMPTZ;
  END IF;
END $$;

-- Add the correct UNIQUE constraint: (store_id, product_id, competitor_url)
-- This matches the onConflict in the upsert: 'store_id,product_id,competitor_url'
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conrelid = 'public.competitor_url_products'::regclass 
    AND conname = 'competitor_url_products_store_id_product_id_competitor_url_key'
  ) THEN
    ALTER TABLE public.competitor_url_products
    ADD CONSTRAINT competitor_url_products_store_id_product_id_competitor_url_key
    UNIQUE (store_id, product_id, competitor_url);
    
    RAISE NOTICE 'Added UNIQUE constraint: competitor_url_products_store_id_product_id_competitor_url_key';
  ELSE
    RAISE NOTICE 'UNIQUE constraint already exists: competitor_url_products_store_id_product_id_competitor_url_key';
  END IF;
END $$;

-- Create index for performance (if it doesn't exist)
CREATE INDEX IF NOT EXISTS idx_competitor_url_products_store_product_url 
ON public.competitor_url_products(store_id, product_id, competitor_url);




