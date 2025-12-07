-- Fix RLS policies for stores table
-- This ensures users can create, read, update, and delete their own stores

-- Step 1: Ensure RLS is enabled on stores table
ALTER TABLE stores ENABLE ROW LEVEL SECURITY;

-- Step 2: Drop ALL existing policies on stores table (to avoid conflicts)
DO $$ 
DECLARE
    r RECORD;
BEGIN
    FOR r IN (SELECT policyname FROM pg_policies WHERE tablename = 'stores') LOOP
        EXECUTE 'DROP POLICY IF EXISTS ' || quote_ident(r.policyname) || ' ON stores';
    END LOOP;
END $$;

-- Step 3: Create INSERT policy
-- Users can insert stores where they are the owner
CREATE POLICY "Users can insert their own stores"
ON stores
FOR INSERT
TO authenticated
WITH CHECK (owner_id = auth.uid());

-- Step 4: Create SELECT policy
-- Users can read stores they own
CREATE POLICY "Users can read their own stores"
ON stores
FOR SELECT
TO authenticated
USING (owner_id = auth.uid());

-- Step 5: Create UPDATE policy
-- Users can update stores they own
CREATE POLICY "Users can update their own stores"
ON stores
FOR UPDATE
TO authenticated
USING (owner_id = auth.uid())
WITH CHECK (owner_id = auth.uid());

-- Step 6: Create DELETE policy
-- Users can delete stores they own
CREATE POLICY "Users can delete their own stores"
ON stores
FOR DELETE
TO authenticated
USING (owner_id = auth.uid());



