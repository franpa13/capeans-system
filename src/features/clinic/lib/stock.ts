export type StockLevel = "out" | "low" | "ok";

/** "out" takes priority over "low": zero or negative stock is always the
 * most severe state regardless of what threshold is configured, since
 * there's nothing left to use at all. */
export function isLowStock(quantity: number, lowStockAt: number | null): StockLevel {
  if (quantity <= 0) return "out";
  if (lowStockAt != null && quantity <= lowStockAt) return "low";
  return "ok";
}
