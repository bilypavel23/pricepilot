-- Simple and reliable fix for RLS policies on products table
-- Run this in Supabase SQL Editor

-- 1. First, ensure stores table has SELECT policy for authenticated users
-- This is CRITICAL - products policies need to read from stores table
ALTER TABLE stores ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read their own stores" ON stores;
DROP POLICY IF EXISTS "Enable read access for all users" ON stores;
DROP POLICY IF EXISTS "Users can read stores" ON stores;

CREATE POLICY "Users can read their own stores"
ON stores
FOR SELECT
TO authenticated
USING (owner_id = auth.uid());

-- 2. Now fix products table policies
ALTER TABLE products ENABLE ROW LEVEL SECURITY;

-- Drop all existing policies
DROP POLICY IF EXISTS "Users can insert products to their stores" ON products;
DROP POLICY IF EXISTS "Users can read products from their stores" ON products;
DROP POLICY IF EXISTS "Users can update products from their stores" ON products;
DROP POLICY IF EXISTS "Users can delete products from their stores" ON products;
DROP POLICY IF EXISTS "Enable insert for authenticated users only" ON products;
DROP POLICY IF EXISTS "Enable read access for all users" ON products;
DROP POLICY IF EXISTS "Enable update for users based on email" ON products;
DROP POLICY IF EXISTS "Enable delete for users based on email" ON products;

-- INSERT policy - users can insert products to their stores
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

-- SELECT policy - users can read their products or demo products
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

-- UPDATE policy
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

-- DELETE policy
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




