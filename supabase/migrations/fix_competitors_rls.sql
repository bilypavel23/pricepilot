-- Fix RLS policies for competitors table
-- This ensures users can insert, read, update, and delete competitors from their stores

-- Step 1: Ensure RLS is enabled on competitors table
ALTER TABLE competitors ENABLE ROW LEVEL SECURITY;

-- Step 2: Drop ALL existing policies on competitors table (to avoid conflicts)
DO $$ 
DECLARE
    r RECORD;
BEGIN
    FOR r IN (SELECT policyname FROM pg_policies WHERE tablename = 'competitors') LOOP
        EXECUTE 'DROP POLICY IF EXISTS ' || quote_ident(r.policyname) || ' ON competitors';
    END LOOP;
END $$;

-- Step 3: Create INSERT policy
-- Users can insert competitors to stores they own
CREATE POLICY "Users can insert competitors to their stores"
ON competitors
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM stores
    WHERE stores.id = competitors.store_id
    AND stores.owner_id = auth.uid()
  )
);

-- Step 4: Create SELECT policy
-- Users can read competitors from their stores OR demo competitors
CREATE POLICY "Users can read competitors from their stores"
ON competitors
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM stores
    WHERE stores.id = competitors.store_id
    AND stores.owner_id = auth.uid()
  )
  OR is_demo = true
);

-- Step 5: Create UPDATE policy
-- Users can update competitors from their stores
CREATE POLICY "Users can update competitors from their stores"
ON competitors
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM stores
    WHERE stores.id = competitors.store_id
    AND stores.owner_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM stores
    WHERE stores.id = competitors.store_id
    AND stores.owner_id = auth.uid()
  )
);

-- Step 6: Create DELETE policy
-- Users can delete competitors from their stores
CREATE POLICY "Users can delete competitors from their stores"
ON competitors
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM stores
    WHERE stores.id = competitors.store_id
    AND stores.owner_id = auth.uid()
  )
);

-- Step 7: Verify that stores table allows reading for authenticated users
-- (This is needed for the policies above to work)
DO $$
BEGIN
    -- Enable RLS on stores if not already enabled
    ALTER TABLE stores ENABLE ROW LEVEL SECURITY;
    
    -- Drop existing SELECT policy on stores if it exists
    DROP POLICY IF EXISTS "Users can read their own stores" ON stores;
    
    -- Create SELECT policy on stores so competitors policies can check ownership
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


