-- Complete fix for RLS policies on products table
-- This script ensures users can insert, read, update, and delete products from their stores

-- Step 1: Ensure RLS is enabled on products table
ALTER TABLE products ENABLE ROW LEVEL SECURITY;

-- Step 2: Drop ALL existing policies on products table (to avoid conflicts)
DO $$ 
DECLARE
    r RECORD;
BEGIN
    FOR r IN (SELECT policyname FROM pg_policies WHERE tablename = 'products') LOOP
        EXECUTE 'DROP POLICY IF EXISTS ' || quote_ident(r.policyname) || ' ON products';
    END LOOP;
END $$;

-- Step 3: Create INSERT policy
-- Users can insert products to stores they own
CREATE POLICY "Users can insert products to their stores"
ON products
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM stores
    WHERE stores.id = products.store_id
    AND stores.owner_id = auth.uid()
  )
);

-- Step 4: Create SELECT policy
-- Users can read products from their stores OR demo products
CREATE POLICY "Users can read products from their stores"
ON products
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM stores
    WHERE stores.id = products.store_id
    AND stores.owner_id = auth.uid()
  )
  OR is_demo = true
);

-- Step 5: Create UPDATE policy
-- Users can update products from their stores
CREATE POLICY "Users can update products from their stores"
ON products
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM stores
    WHERE stores.id = products.store_id
    AND stores.owner_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM stores
    WHERE stores.id = products.store_id
    AND stores.owner_id = auth.uid()
  )
);

-- Step 6: Create DELETE policy
-- Users can delete products from their stores
CREATE POLICY "Users can delete products from their stores"
ON products
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM stores
    WHERE stores.id = products.store_id
    AND stores.owner_id = auth.uid()
  )
);

-- Step 7: Verify that stores table allows reading for authenticated users
-- (This is needed for the policies above to work)
-- Check if stores table has RLS enabled and appropriate policies
DO $$
BEGIN
    -- Enable RLS on stores if not already enabled
    ALTER TABLE stores ENABLE ROW LEVEL SECURITY;
    
    -- Drop existing SELECT policy on stores if it exists
    DROP POLICY IF EXISTS "Users can read their own stores" ON stores;
    
    -- Create SELECT policy on stores so products policies can check ownership
    CREATE POLICY "Users can read their own stores"
    ON stores
    FOR SELECT
    TO authenticated
    USING (owner_id = auth.uid());
    
EXCEPTION
    WHEN others THEN
        -- If stores table doesn't exist or has issues, log but continue
        RAISE NOTICE 'Could not set up stores policies: %', SQLERRM;
END $$;




