-- Enable users to insert products into their own stores
-- This policy allows authenticated users to insert products where store_id matches their owned store

-- First, drop existing insert policy if it exists
DROP POLICY IF EXISTS "Users can insert products to their stores" ON products;

-- Create policy that allows users to insert products to stores they own
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

-- Also ensure users can read their own products
DROP POLICY IF EXISTS "Users can read products from their stores" ON products;

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
  OR is_demo = true  -- Allow reading demo products
);

-- Allow users to update their own products
DROP POLICY IF EXISTS "Users can update products from their stores" ON products;

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

-- Allow users to delete their own products
DROP POLICY IF EXISTS "Users can delete products from their stores" ON products;

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



