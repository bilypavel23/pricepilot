/**
 * Price Hash Computation
 * 
 * Computes hash of price data for change detection
 */

/**
 * Compute price hash for change detection
 */
export function computePriceHash(price: number | null, currency: string): string {
  const data = `${price || 0}|${currency}`;
  // Simple hash (in production, use crypto.createHash)
  let hash = 0;
  for (let i = 0; i < data.length; i++) {
    const char = data.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash).toString(36);
}

