// Bag types shared by the server and client components. Client-safe: no
// database access here. Prices are whole dollars, like `Product`.
import type { Photo } from "@/lib/products";
import type { StockState } from "@/lib/stock";

/** Why a line can't be bought as it stands. */
export type CartIssue =
  /** Nothing left and not made to order. Left out of the subtotal. */
  | "sold-out"
  /** More in the bag (all sizes together) than is now available. */
  | "reduced";

export type CartLine = {
  productId: number;
  slug: string;
  name: string;
  colour: string;
  /** Empty for one-size products. */
  size: string;
  image?: Photo;
  /** Current unit price; never stored in the bag. */
  price: number;
  salePrice?: number;
  quantity: number;
  lineTotal: number;
  /** How many of this product can be in the bag, all sizes together. */
  available: number;
  /** The highest this line can go, given the product's other sizes in the bag. */
  maxQuantity: number;
  /** Availability as the product page shows it, from `stockState`. */
  stockState: StockState;
  /** Units in stock, for `stockCopy` ("Only 2 left"). */
  stockUnits: number;
  /** Lead time for made-to-order pieces. */
  stockDetail?: string;
  issue?: CartIssue;
};

export type CartView = {
  lines: CartLine[];
  /** Units across all lines. */
  itemCount: number;
  /** Sum of line totals, leaving out sold-out lines. */
  subtotal: number;
  hasIssues: boolean;
};

export type CartActionResult = { ok: true; message?: string } | { ok: false; error: string };
