// The four availability states and how the storefront words and colours them.
// Client-safe: product cards, the product page and the purchase panel all use it.
// Stock is one quantity per product (sizes share it), as in the example database.

export type StockState = "in-stock" | "low-stock" | "sold-out" | "made-to-order";

/** At or below this many units, tell shoppers how many are left. */
export const LOW_STOCK_THRESHOLD = 3;

export function stockState(units: number, madeToOrder = false): StockState {
  if (units <= 0) return madeToOrder ? "made-to-order" : "sold-out";
  if (units <= LOW_STOCK_THRESHOLD) return "low-stock";
  return "in-stock";
}

/** Whether the product can be added to the bag. */
export function isOrderable(state: StockState) {
  return state !== "sold-out";
}

/** The most of one product a bag can hold, across all its sizes. */
export const MAX_LINE_QUANTITY = 10;

/**
 * How many of a product can be in the bag at once, all sizes together.
 * Made-to-order pieces aren't limited by stock; everything else is.
 */
export function maxOrderable(units: number, madeToOrder = false) {
  if (madeToOrder) return MAX_LINE_QUANTITY;
  return Math.max(0, Math.min(units, MAX_LINE_QUANTITY));
}

export function stockCopy(state: StockState, units: number) {
  switch (state) {
    case "in-stock":
      return "In stock";
    case "low-stock":
      return `Only ${units} left`;
    case "sold-out":
      return "Sold out";
    case "made-to-order":
      return "Made to order";
  }
}

/** Text colour for each state, from the design tokens. */
export function stockTone(state: StockState) {
  switch (state) {
    case "in-stock":
      return "text-confirm";
    case "low-stock":
      return "font-medium";
    case "sold-out":
      return "text-graphite";
    case "made-to-order":
      return "text-black";
  }
}
