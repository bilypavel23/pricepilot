-- Simple and reliable fix for RLS policies on stores table
-- Run this in Supabase SQL Editor

-- 1. Enable RLS on stores table
ALTER TABLE stores ENABLE ROW LEVEL SECURITY;

-- 2. Drop all existing policies
DROP POLICY IF EXISTS "Users can insert their own stores" ON stores;
DROP POLICY IF EXISTS "Users can read their own stores" ON stores;
DROP POLICY IF EXISTS "Users can update their own stores" ON stores;
DROP POLICY IF EXISTS "Users can delete their own stores" ON stores;
DROP POLICY IF EXISTS "Enable insert for authenticated users only" ON stores;
DROP POLICY IF EXISTS "Enable read access for all users" ON stores;
DROP POLICY IF EXISTS "Enable update for users based on email" ON stores;
DROP POLICY IF EXISTS "Enable delete for users based on email" ON stores;

-- 3. INSERT policy - users can insert stores where they are the owner
CREATE POLICY "Users can insert their own stores"
ON stores
FOR INSERT
TO authenticated
WITH CHECK (owner_id = auth.uid());

-- 4. SELECT policy - users can read stores they own
CREATE POLICY "Users can read their own stores"
ON stores
FOR SELECT
TO authenticated
USING (owner_id = auth.uid());

-- 5. UPDATE policy - users can update stores they own
CREATE POLICY "Users can update their own stores"
ON stores
FOR UPDATE
TO authenticated
USING (owner_id = auth.uid())
WITH CHECK (owner_id = auth.uid());

-- 6. DELETE policy - users can delete stores they own
CREATE POLICY "Users can delete their own stores"
ON stores
FOR DELETE
TO authenticated
USING (owner_id = auth.uid());




