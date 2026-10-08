// Builds the bag from the cookie and fresh product rows. Prices, stock and
// the subtotal are worked out here on every request, in cents.
import "server-only";
import { cache } from "react";
import {
  getCartProducts,
  mapCart,
  type CartLineCents,
  type CartProduct,
} from "@/db/queries";
import type { CartView } from "./types";
import { maxOrderable, stockState } from "@/lib/stock";
import { readCartLines, type StoredLine } from "./cookie";

/** Whether `size` is valid for the product: one of its sizes, or "" for one-size pieces. */
export function isValidSize(product: Pick<CartProduct, "sizes">, size: string) {
  return product.sizes.length === 0 ? size === "" : product.sizes.includes(size);
}

/**
 * Lines whose product no longer exists, or whose size is no longer offered,
 * are dropped. The rest are priced and checked against current stock.
 */
export function buildCart(stored: StoredLine[], products: CartProduct[]): CartView {
  const byId = new Map(products.map((p) => [p.id, p]));
  const valid = stored.filter((l) => {
    const product = byId.get(l.productId);
    return product !== undefined && isValidSize(product, l.size);
  });

  // Stock is shared by all sizes, so limits apply to the product's total.
  const totals = new Map<number, number>();
  for (const l of valid) totals.set(l.productId, (totals.get(l.productId) ?? 0) + l.quantity);

  let subtotalCents = 0;
  const lines: CartLineCents[] = valid.map((l) => {
    const p = byId.get(l.productId)!;
    const available = maxOrderable(p.stockQuantity, p.madeToOrder);
    const productTotal = totals.get(l.productId)!;
    const issue =
      available === 0 ? "sold-out" : productTotal > available ? "reduced" : undefined;
    const unitCents = p.salePriceCents ?? p.priceCents;
    const lineTotalCents = unitCents * l.quantity;
    if (issue !== "sold-out") subtotalCents += lineTotalCents;

    return {
      productId: p.id,
      slug: p.slug,
      name: p.name,
      colour: p.colour,
      size: l.size,
      image: p.image,
      priceCents: p.priceCents,
      salePriceCents: p.salePriceCents,
      quantity: l.quantity,
      lineTotalCents,
      available,
      maxQuantity: Math.max(0, available - (productTotal - l.quantity)),
      stockState: stockState(p.stockQuantity, p.madeToOrder),
      stockUnits: p.stockQuantity,
      stockDetail: p.stockDetail,
      issue,
    };
  });

  return mapCart(lines, subtotalCents);
}

/** The bag for this request: one database query, shared by every caller. */
export const getCart = cache(async (): Promise<CartView> => {
  const stored = await readCartLines();
  if (stored.length === 0) return buildCart([], []);
  const products = await getCartProducts([...new Set(stored.map((l) => l.productId))]);
  return buildCart(stored, products);
});
