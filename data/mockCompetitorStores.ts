import { CompetitorStore, CompetitorProduct, ProductMatch } from "@/types";

// TODO: Replace with real Supabase data
// In-memory mock data for competitor stores
let mockStores: CompetitorStore[] = [];

// TODO: Replace with real Supabase data
// In-memory mock data for competitor products
let mockCompetitorProducts: CompetitorProduct[] = [];

// TODO: Replace with real Supabase data
// In-memory mock data for product matches
let mockProductMatches: ProductMatch[] = [];

// Helper to generate a simple ID
function generateId(): string {
  return `store-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

function generateProductId(): string {
  return `comp-prod-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

function generateMatchId(): string {
  return `match-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

// Mock competitor product names
const mockProductNames = [
  "Wireless Headphones Pro",
  "4K Monitor 27\"",
  "USB-C Charger 65W",
  "Mechanical Keyboard RGB",
  "Laptop Stand Aluminum",
  "Smart Watch Series 5",
  "Bluetooth Speaker Portable",
  "Webcam HD 1080p",
];

// TODO: Replace with real Supabase queries
export function addCompetitorStore(name: string, url: string): CompetitorStore {
  const store: CompetitorStore = {
    id: generateId(),
    name,
    url,
    createdAt: new Date().toISOString(),
  };
  mockStores.push(store);
  return store;
}

// TODO: Replace with real scraping logic
export function generateMockCompetitorProducts(storeId: string, count: number = 5): CompetitorProduct[] {
  const products: CompetitorProduct[] = [];
  const usedNames = new Set<string>();
  
  for (let i = 0; i < count; i++) {
    let name = mockProductNames[Math.floor(Math.random() * mockProductNames.length)];
    // Ensure unique names
    while (usedNames.has(name)) {
      name = mockProductNames[Math.floor(Math.random() * mockProductNames.length)];
    }
    usedNames.add(name);
    
    products.push({
      id: generateProductId(),
      storeId,
      name,
      sku: `COMP-${Math.random().toString(36).substr(2, 6).toUpperCase()}`,
      price: Math.round((Math.random() * 200 + 10) * 100) / 100, // $10-$210
    });
  }
  
  mockCompetitorProducts.push(...products);
  return products;
}

// TODO: Replace with real matching logic using scraped feed + AI embeddings
export function generateMockProductMatches(
  storeId: string,
  myProducts: Array<{ id: string; name: string }>,
  competitorProducts: CompetitorProduct[]
): ProductMatch[] {
  const matches: ProductMatch[] = [];
  
  myProducts.forEach((myProduct, index) => {
    // Simple index-based pairing with some randomness
    const competitorProduct = competitorProducts[index % competitorProducts.length];
    if (!competitorProduct) return;
    
    // Generate confidence: 0.7-0.95 with some variation
    const baseConfidence = 0.7 + Math.random() * 0.25;
    const confidence = Math.min(0.95, baseConfidence);
    
    // Determine initial status based on confidence
    let status: "AUTO_MATCHED" | "PENDING" | "REJECTED" | "CONFIRMED";
    if (confidence >= 0.9) {
      status = "AUTO_MATCHED";
    } else {
      status = "PENDING";
    }
    
    matches.push({
      id: generateMatchId(),
      myProductId: myProduct.id,
      competitorProductId: competitorProduct.id,
      storeId,
      confidence,
      status,
    });
  });
  
  mockProductMatches.push(...matches);
  return matches;
}

// TODO: Replace with real Supabase queries
export function getCompetitorStores(): CompetitorStore[] {
  return [...mockStores];
}

// TODO: Replace with real Supabase queries
export function getCompetitorProducts(storeId: string): CompetitorProduct[] {
  return mockCompetitorProducts.filter((p) => p.storeId === storeId);
}

// TODO: Replace with real Supabase queries
export function getProductMatches(storeId: string): ProductMatch[] {
  return mockProductMatches.filter((m) => m.storeId === storeId);
}

// TODO: Replace with real Supabase update
export function updateProductMatchStatus(matchId: string, status: ProductMatch["status"]): void {
  const match = mockProductMatches.find((m) => m.id === matchId);
  if (match) {
    match.status = status;
  }
}

// TODO: Replace with real Supabase update
export function updateProductMatchCompetitor(
  matchId: string,
  competitorProductId: string
): void {
  const match = mockProductMatches.find((m) => m.id === matchId);
  if (match) {
    match.competitorProductId = competitorProductId;
  }
}

// TODO: Replace with real Supabase queries
export function getCompetitorStore(storeId: string): CompetitorStore | undefined {
  return mockStores.find((s) => s.id === storeId);
}

