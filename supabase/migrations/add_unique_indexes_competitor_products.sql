-- Add unique index on competitor_products(competitor_id, url) to support upsert
-- This prevents duplicate competitor products for the same competitor and URL
CREATE UNIQUE INDEX IF NOT EXISTS competitor_products_competitor_url_unique
ON public.competitor_products (competitor_id, url);

-- Add unique index on product_matches(product_id, competitor_product_id) to prevent duplicate matches
-- This ensures a product can only be matched to the same competitor product once
CREATE UNIQUE INDEX IF NOT EXISTS product_matches_product_competitor_unique
ON public.product_matches (product_id, competitor_product_id);


