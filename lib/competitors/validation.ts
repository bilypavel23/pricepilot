/**
 * Check if a URL is an Amazon domain
 * Blocks various Amazon domains and subdomains
 */
export function isAmazonUrl(url: string): boolean {
  if (!url || typeof url !== "string") {
    return false;
  }

  const normalized = url.toLowerCase().trim();

  return (
    normalized.includes("amazon.") ||
    normalized.includes("amzn.") ||
    normalized.includes("amazon.co") ||
    normalized.includes("amazon.com") ||
    normalized.includes("amazon.de") ||
    normalized.includes("amazon.uk") ||
    normalized.includes("amazon.fr") ||
    normalized.includes("amazon.it") ||
    normalized.includes("amazon.es") ||
    normalized.includes("amazon.ca") ||
    normalized.includes("amazon.jp") ||
    normalized.includes("amazon.in") ||
    normalized.includes("amazon.com.au") ||
    normalized.includes("amazon.com.br") ||
    normalized.includes("amazon.com.mx")
  );
}


