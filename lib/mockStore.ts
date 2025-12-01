import { Product } from "@/types";
import { mockProducts } from "@/data/mockData";

// Global in-memory store for mock data persistence
declare global {
  var __mockProductsStore: Product[] | undefined;
}

function getStore(): Product[] {
  if (!global.__mockProductsStore) {
    global.__mockProductsStore = [...mockProducts];
    console.log(`[mockStore] Initialized global store with ${global.__mockProductsStore.length} products`);
  }
  return global.__mockProductsStore;
}

export function getProductsFromStore(): Product[] {
  const products = getStore();
  console.log(`[mockStore] getProducts() returning ${products.length} products`);
  return products;
}

export function addProductToStore(product: Product): void {
  const store = getStore();
  store.push(product);
  console.log(`[mockStore] Added product: ${product.name}, total: ${store.length}`);
}

export function removeProductFromStore(productId: string): void {
  const store = getStore();
  const index = store.findIndex((p) => p.id === productId);
  if (index !== -1) {
    store.splice(index, 1);
    console.log(`[mockStore] Removed product: ${productId}, total: ${store.length}`);
  }
}

export function updateProductInStore(productId: string, updates: Partial<Product>): void {
  const store = getStore();
  const index = store.findIndex((p) => p.id === productId);
  if (index !== -1) {
    store[index] = { ...store[index], ...updates };
    console.log(`[mockStore] Updated product: ${productId}`);
  }
}

