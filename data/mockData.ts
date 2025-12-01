import { Product, PriceRecommendation } from "@/types";

export const mockProducts: Product[] = [
  {
    id: "1",
    name: "Wireless Headphones",
    sku: "WH-001",
    currentPrice: 79.99,
    currency: "USD",
    cost: 40,
    marginPercent: 50,
    inventory: 25,
  },
  {
    id: "2",
    name: "Smart Watch",
    sku: "SW-002",
    currentPrice: 199.99,
    currency: "USD",
    cost: 120,
    marginPercent: 40,
    inventory: 15,
  },
  {
    id: "3",
    name: "USB-C Cable",
    sku: "UC-003",
    currentPrice: 12.99,
    currency: "USD",
    cost: 5,
    marginPercent: 61.5,
    inventory: 100,
  },
  {
    id: "4",
    name: "Laptop Stand",
    sku: "LS-004",
    currentPrice: 49.99,
    currency: "USD",
    cost: 20,
    marginPercent: 60,
    inventory: 8,
  },
  {
    id: "5",
    name: "Mechanical Keyboard",
    sku: "MK-005",
    currentPrice: 129.99,
    currency: "USD",
    cost: 70,
    marginPercent: 46.2,
    inventory: 12,
  },
];

export const mockRecommendations: PriceRecommendation[] = [
  {
    id: "rec-1",
    productId: "1",
    productName: "Wireless Headphones",
    currentPrice: 79.99,
    suggestedPrice: 84.99,
    changePercent: 6.25,
    direction: "UP",
    reason: "Competitor prices increased by 8%",
    status: "PENDING",
  },
  {
    id: "rec-2",
    productId: "2",
    productName: "Smart Watch",
    currentPrice: 199.99,
    suggestedPrice: 189.99,
    changePercent: -5,
    direction: "DOWN",
    reason: "Market average is 5% lower",
    status: "PENDING",
  },
  {
    id: "rec-3",
    productId: "3",
    productName: "USB-C Cable",
    currentPrice: 12.99,
    suggestedPrice: 12.99,
    changePercent: 0,
    direction: "SAME",
    reason: "Price is optimal",
    status: "PENDING",
  },
];

export const mockCompetitors = [
  {
    id: "comp-1",
    name: "TechStore",
    url: "https://techstore.com",
    products: [
      { productId: "1", price: 74.99 },
      { productId: "2", price: 194.99 },
    ],
  },
  {
    id: "comp-2",
    name: "ElectroHub",
    url: "https://electrohub.com",
    products: [
      { productId: "1", price: 82.99 },
      { productId: "3", price: 11.99 },
    ],
  },
];

