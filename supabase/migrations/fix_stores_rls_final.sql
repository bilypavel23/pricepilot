-- Final fix for RLS policies on stores table
-- This MUST be run in Supabase SQL Editor for getOrCreateStore() to work

-- Step 1: Enable RLS (if not already enabled)
ALTER TABLE stores ENABLE ROW LEVEL SECURITY;

-- Step 2: Drop ALL existing policies (use simple DROP statements)
DROP POLICY IF EXISTS "Users can insert their own stores" ON stores;
DROP POLICY IF EXISTS "Users can read their own stores" ON stores;
DROP POLICY IF EXISTS "Users can update their own stores" ON stores;
DROP POLICY IF EXISTS "Users can delete their own stores" ON stores;
DROP POLICY IF EXISTS "Enable insert for authenticated users only" ON stores;
DROP POLICY IF EXISTS "Enable read access for all users" ON stores;
DROP POLICY IF EXISTS "Enable update for users based on email" ON stores;
DROP POLICY IF EXISTS "Enable delete for users based on email" ON stores;
DROP POLICY IF EXISTS "Users can insert stores" ON stores;
DROP POLICY IF EXISTS "Users can read stores" ON stores;
DROP POLICY IF EXISTS "Users can update stores" ON stores;
DROP POLICY IF EXISTS "Users can delete stores" ON stores;

-- Step 3: Create INSERT policy - CRITICAL for getOrCreateStore()
CREATE POLICY "Users can insert their own stores"
ON stores
FOR INSERT
TO authenticated
WITH CHECK (owner_id = auth.uid());

-- Step 4: Create SELECT policy - needed for reading stores
CREATE POLICY "Users can read their own stores"
ON stores
FOR SELECT
TO authenticated
USING (owner_id = auth.uid());

-- Step 5: Create UPDATE policy - needed for updating stores
CREATE POLICY "Users can update their own stores"
ON stores
FOR UPDATE
TO authenticated
USING (owner_id = auth.uid())
WITH CHECK (owner_id = auth.uid());

-- Step 6: Create DELETE policy - needed for deleting stores
CREATE POLICY "Users can delete their own stores"
ON stores
FOR DELETE
TO authenticated
USING (owner_id = auth.uid());

-- Verify policies were created
SELECT policyname, cmd, qual 
FROM pg_policies 
WHERE tablename = 'stores';




