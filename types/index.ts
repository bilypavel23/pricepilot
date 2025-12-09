export type Product = {
  id: string;
  name: string;
  sku: string;
  currentPrice: number;
  currency: string;
  cost: number;
  marginPercent: number;
  inventory?: number | null;
};

export type CompetitorPrice = {
  label: string; // e.g. "Competitor 1"
  name?: string | null; // product name
  url?: string | null; // link to competitor product
  oldPrice?: number | null; // previous competitor price
  newPrice?: number | null; // current competitor price
  changePercent?: number | null; // positive/negative/zero
};

export type PriceRecommendation = {
  id: string;
  productId: string;
  productName: string;
  currentPrice: number;
  suggestedPrice: number;
  changePercent: number;
  direction: "UP" | "DOWN" | "SAME";
  reason: string;
  status?: "PENDING" | "APPLIED" | "DISMISSED";
  competitors?: CompetitorPrice[];
};

export type CompetitorStore = {
  id: string;
  name: string;
  url: string;
  createdAt: string;
};

export type CompetitorProduct = {
  id: string;
  storeId: string;
  name: string;
  sku?: string;
  price: number;
};

export type ProductMatch = {
  id: string;
  myProductId: string;
  competitorProductId: string;
  storeId: string;
  confidence: number; // 0–1
  status: "AUTO_MATCHED" | "PENDING" | "REJECTED" | "CONFIRMED";
};
