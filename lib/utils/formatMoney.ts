/**
 * Format a monetary amount with currency symbol
 * @param amount - The amount to format (can be null/undefined/NaN)
 * @param currency - Currency code (default: "USD")
 * @returns Formatted string like "$55.00" or "—" if amount is invalid
 */
export function formatMoney(amount: number | null | undefined, currency: string = "USD"): string {
  // Handle invalid amounts
  if (amount == null || isNaN(amount)) {
    return "—";
  }

  // Get currency symbol
  const currencySymbols: Record<string, string> = {
    USD: "$",
    EUR: "€",
    GBP: "£",
    JPY: "¥",
    CAD: "C$",
    AUD: "A$",
    CHF: "CHF",
    CNY: "¥",
    SEK: "kr",
    NZD: "NZ$",
    MXN: "$",
    SGD: "S$",
    HKD: "HK$",
    NOK: "kr",
    TRY: "₺",
    RUB: "₽",
    INR: "₹",
    BRL: "R$",
    ZAR: "R",
    KRW: "₩",
  };

  const symbol = currencySymbols[currency.toUpperCase()] || currency.toUpperCase();

  // Format with 2 decimal places
  return `${symbol}${amount.toFixed(2)}`;
}


