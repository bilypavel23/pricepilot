export type CompetitorSlot = {
  label: string;            // "Competitor 1", ...
  name?: string | null;     // competitor product name (competitor_name from view)
  url?: string | null;      // competitor product URL
  oldPrice?: number | null; // previous competitor price (for now can be null)
  newPrice?: number | null; // current competitor price
  changePercent?: number | null;
  source?: "Store" | "URL"; // source badge: "Store" or "URL"
  isUrlCompetitor?: boolean; // deprecated - use source instead
};

export type ProductRecommendation = {
  productId: string;
  productName: string;
  productSku?: string | null;
  productPrice: number | null;

  // recommendation core:
  recommendedPrice: number | null;
  changePercent: number;     // difference between my price and recommended in %
  competitorAvg: number;     // average competitor price
  competitorCount: number;   // how many competitors matched

  // explanation text (for UI):
  explanation: string;

  // competitors panel
  competitors: CompetitorSlot[];
};

