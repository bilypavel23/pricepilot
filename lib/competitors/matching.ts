export type BaseProduct = {
  id: string;
  name: string;
  sku?: string | null;
};

export type MatchCandidate = {
  productId: string;
  competitorProductId: string;
  similarity: number; // 0–100
};

/**
 * Normalize strings: lower, strip special chars, collapse spaces.
 */
function normalize(str: string): string {
  return str
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Very simple token-based similarity:
 * Jaccard-like: 2 * intersection / (lenA + lenB)
 */
function tokenSimilarity(a: string, b: string): number {
  const tokensA = new Set(normalize(a).split(" "));
  const tokensB = new Set(normalize(b).split(" "));
  if (!tokensA.size || !tokensB.size) return 0;
  let intersection = 0;
  for (const t of tokensA) {
    if (tokensB.has(t)) intersection++;
  }
  const score = (2 * intersection) / (tokensA.size + tokensB.size);
  return Math.round(score * 100); // 0–100
}

/**
 * Combine SKU match (pokud existuje) + name similarity.
 */
function computeSimilarity(
  my: BaseProduct,
  comp: BaseProduct
): number {
  let score = tokenSimilarity(my.name, comp.name);
  const mySku = my.sku?.trim();
  const compSku = comp.sku?.trim();
  if (mySku && compSku && mySku.toLowerCase() === compSku.toLowerCase()) {
    // SKU match = velký boost
    score = Math.max(score, 90);
  }
  return score;
}

/**
 * Najde nejlepšího kandidáta z competitor produktů pro každý můj produkt.
 * Vrací jen páry nad daným prahem.
 */
export function findBestMatches(
  myProducts: BaseProduct[],
  competitorProducts: BaseProduct[],
  minScore = 60            // pod 60 % match neukazujeme
): MatchCandidate[] {
  const results: MatchCandidate[] = [];

  for (const my of myProducts) {
    let best: { comp: BaseProduct; score: number } | null = null;

    for (const cp of competitorProducts) {
      const score = computeSimilarity(my, cp);
      if (!best || score > best.score) {
        best = { comp: cp, score };
      }
    }

    if (best && best.score >= minScore) {
      results.push({
        productId: my.id,
        competitorProductId: best.comp.id,
        similarity: best.score,
      });
    }
  }

  return results;
}

