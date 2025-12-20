/**
 * Title Normalization
 * 
 * Normalizes product titles for matching:
 * - Lowercase
 * - Remove punctuation
 * - Collapse whitespace
 * - Remove diacritics (accents)
 */

/**
 * Normalize a title string for matching
 */
export function normalizeTitle(str: string | null | undefined): string {
  if (!str) return "";
  
  return str
    .toLowerCase()
    .normalize("NFD") // Decompose characters (é -> e + ´)
    .replace(/[\u0300-\u036f]/g, "") // Remove diacritics
    .replace(/[^a-z0-9\s]/g, "") // Remove punctuation
    .replace(/\s+/g, " ") // Collapse whitespace
    .trim();
}

