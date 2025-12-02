export type CsvColumnMapping = {
  name?: string;      // CSV column name for product.name
  sku?: string;       // CSV column name for product.sku
  price?: string;     // CSV column name for product.price
  cost?: string;      // CSV column name for product.cost
  inventory?: string; // CSV column name for product.inventory
};

// Field aliases for auto-mapping
const FIELD_ALIASES: Record<keyof CsvColumnMapping, string[]> = {
  name: ["name", "product_name", "title"],
  sku: ["sku", "id", "product_id", "code"],
  price: ["price", "currentprice", "current_price", "our_price", "cena", "price_with_vat"],
  cost: ["cost", "buy_price", "purchase_price"],
  inventory: ["inventory", "stock", "qty", "quantity"],
};

/**
 * Auto-maps CSV column headers to product fields based on aliases.
 * Returns a mapping object indicating which CSV column should be used for each field.
 */
export function autoMapCsvColumns(headers: string[]): CsvColumnMapping {
  const mapping: CsvColumnMapping = {};
  const normalizedHeaders = headers.map((h) => h.trim().toLowerCase());

  // For each field, find the first matching header
  (Object.keys(FIELD_ALIASES) as Array<keyof CsvColumnMapping>).forEach((field) => {
    const aliases = FIELD_ALIASES[field];
    
    // Try to find exact match first
    for (const alias of aliases) {
      const index = normalizedHeaders.indexOf(alias);
      if (index !== -1) {
        mapping[field] = headers[index]; // Use original header case
        return;
      }
    }

    // Try partial match (contains alias)
    for (const alias of aliases) {
      const found = normalizedHeaders.find((h) => h.includes(alias) || alias.includes(h));
      if (found) {
        const index = normalizedHeaders.indexOf(found);
        mapping[field] = headers[index];
        return;
      }
    }
  });

  return mapping;
}

/**
 * Validates that required fields are mapped.
 */
export function validateMapping(mapping: CsvColumnMapping): { valid: boolean; missing: string[] } {
  const required: Array<keyof CsvColumnMapping> = ["name", "sku", "price"];
  const missing = required.filter((field) => !mapping[field]);

  return {
    valid: missing.length === 0,
    missing,
  };
}

