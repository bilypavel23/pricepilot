-- Fix RLS policies for products table
-- This ensures users can insert, read, update, and delete products from their stores

-- First, ensure RLS is enabled on products table
ALTER TABLE products ENABLE ROW LEVEL SECURITY;

-- Drop all existing policies to start fresh
DROP POLICY IF EXISTS "Users can insert products to their stores" ON products;
DROP POLICY IF EXISTS "Users can read products from their stores" ON products;
DROP POLICY IF EXISTS "Users can update products from their stores" ON products;
DROP POLICY IF EXISTS "Users can delete products from their stores" ON products;
DROP POLICY IF EXISTS "Enable insert for authenticated users only" ON products;
DROP POLICY IF EXISTS "Enable read access for all users" ON products;
DROP POLICY IF EXISTS "Enable update for users based on email" ON products;
DROP POLICY IF EXISTS "Enable delete for users based on email" ON products;

-- Policy for INSERT: Users can insert products to stores they own
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

-- Policy for SELECT: Users can read products from their stores OR demo products
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

-- Policy for UPDATE: Users can update products from their stores
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

-- Policy for DELETE: Users can delete products from their stores
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



