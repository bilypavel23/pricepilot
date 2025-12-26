-- ============================================================================
-- Fix UNIQUE constraint on competitor_product_matches
-- ============================================================================
-- This migration ensures the UNIQUE constraint matches the onConflict used in code:
-- onConflict: "store_id,competitor_id,product_id"
-- ============================================================================

-- Drop old UNIQUE constraints if they exist (they don't include store_id)
DO $$ 
BEGIN
  -- Drop constraint on (competitor_id, my_product_id) if exists
  IF EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'competitor_product_matches_competitor_id_my_product_id_key'
    AND conrelid = 'public.competitor_product_matches'::regclass
  ) THEN
    ALTER TABLE public.competitor_product_matches 
    DROP CONSTRAINT competitor_product_matches_competitor_id_my_product_id_key;
  END IF;

  -- Drop constraint on (competitor_store_id, my_product_id) if exists
  IF EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'competitor_product_matches_competitor_store_id_my_product_id_key'
    AND conrelid = 'public.competitor_product_matches'::regclass
  ) THEN
    ALTER TABLE public.competitor_product_matches 
    DROP CONSTRAINT competitor_product_matches_competitor_store_id_my_product_id_key;
  END IF;

  -- Drop any other UNIQUE constraints that don't match our target
  -- (This handles any other variations)
  FOR r IN (
    SELECT conname 
    FROM pg_constraint 
    WHERE contype = 'u'
    AND conrelid = 'public.competitor_product_matches'::regclass
    AND conname != 'competitor_product_matches_pkey'
  ) LOOP
    EXECUTE format('ALTER TABLE public.competitor_product_matches DROP CONSTRAINT %I', r.conname);
  END LOOP;
END $$;

-- Ensure store_id, competitor_id, and product_id columns exist
DO $$ 
BEGIN
  -- Ensure store_id exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'competitor_product_matches' 
    AND column_name = 'store_id'
  ) THEN
    ALTER TABLE public.competitor_product_matches 
    ADD COLUMN store_id UUID REFERENCES public.stores(id) ON DELETE CASCADE;
  END IF;

  -- Ensure competitor_id exists (may be named competitor_store_id)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'competitor_product_matches' 
    AND column_name = 'competitor_id'
  ) THEN
    IF EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_schema = 'public' 
      AND table_name = 'competitor_product_matches' 
      AND column_name = 'competitor_store_id'
    ) THEN
      ALTER TABLE public.competitor_product_matches 
      RENAME COLUMN competitor_store_id TO competitor_id;
    ELSE
      ALTER TABLE public.competitor_product_matches 
      ADD COLUMN competitor_id UUID REFERENCES public.competitors(id) ON DELETE CASCADE;
    END IF;
  END IF;

  -- Ensure product_id exists (may be named my_product_id)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'competitor_product_matches' 
    AND column_name = 'product_id'
  ) THEN
    IF EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_schema = 'public' 
      AND table_name = 'competitor_product_matches' 
      AND column_name = 'my_product_id'
    ) THEN
      ALTER TABLE public.competitor_product_matches 
      RENAME COLUMN my_product_id TO product_id;
    ELSE
      ALTER TABLE public.competitor_product_matches 
      ADD COLUMN product_id UUID REFERENCES public.products(id) ON DELETE CASCADE;
    END IF;
  END IF;
END $$;

-- Add the correct UNIQUE constraint: (store_id, competitor_id, product_id)
-- This matches the onConflict used in the code
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'competitor_product_matches_store_id_competitor_id_product_id_key'
    AND conrelid = 'public.competitor_product_matches'::regclass
  ) THEN
    ALTER TABLE public.competitor_product_matches 
    ADD CONSTRAINT competitor_product_matches_store_id_competitor_id_product_id_key 
    UNIQUE (store_id, competitor_id, product_id);
  END IF;
END $$;

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_product_matches_store_competitor_product 
ON public.competitor_product_matches(store_id, competitor_id, product_id);




