import { Product } from "@/types";
import {
  getProductsFromStore,
  addProductToStore,
  removeProductFromStore,
  updateProductInStore,
} from "./mockStore";

export async function getProducts(): Promise<Product[]> {
  const products = getProductsFromStore();
  console.log(`[api] getProducts() returning ${products.length} products`);
  return [...products]; // Return a copy to ensure React Query detects changes
}

export async function addProduct(product: Omit<Product, "id">): Promise<Product> {
  const newProduct: Product = {
    ...product,
    id: `product-${Date.now()}`,
  };
  addProductToStore(newProduct);
  return newProduct;
}

export async function deleteProduct(productId: string): Promise<void> {
  removeProductFromStore(productId);
}

export async function updateProductPrice(
  productId: string,
  newPrice: number
): Promise<Product> {
  const products = getProductsFromStore();
  const product = products.find((p) => p.id === productId);
  if (!product) {
    throw new Error("Product not found");
  }

  const updatedProduct = {
    ...product,
    currentPrice: newPrice,
    marginPercent: ((newPrice - product.cost) / newPrice) * 100,
  };

  updateProductInStore(productId, updatedProduct);
  return updatedProduct;
}

