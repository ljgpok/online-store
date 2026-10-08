// Turns a validated bag into an order and takes its stock, in one database
// transaction. Prices come from the product rows read here, never from the
// client. If another shopper took the stock first, the products CHECK
// (stock_quantity >= 0) fails and the whole batch rolls back.
import "server-only";
import { eq, sql } from "drizzle-orm";
import { db } from "@/db";
import type { CartProduct } from "@/db/queries";
import { orderItems, orders, products } from "@/db/schema";
import type { StoredLine } from "@/lib/cart/cookie";

export type Reservation = {
  orderId: string;
  totalCents: number;
  items: (typeof orderItems.$inferInsert)[];
};

export type ReserveResult = { ok: true; reservation: Reservation } | { ok: false; reason: "stock" };

export async function reserveOrder(
  user: { id: string; email: string },
  lines: StoredLine[],
  productsById: Map<number, CartProduct>,
): Promise<ReserveResult> {
  const orderId = crypto.randomUUID();

  // Made-to-order pieces only take what's on the shelf; the rest is made.
  const shelfLeft = new Map<number, number>();
  for (const p of productsById.values()) {
    shelfLeft.set(p.id, p.madeToOrder ? p.stockQuantity : Number.POSITIVE_INFINITY);
  }

  const items = lines.map((line) => {
    const p = productsById.get(line.productId)!;
    const unitPriceCents = p.salePriceCents ?? p.priceCents;
    const left = shelfLeft.get(p.id)!;
    const reservedQuantity = Math.min(line.quantity, left);
    shelfLeft.set(p.id, left - reservedQuantity);
    return {
      orderId,
      productId: p.id,
      productSlug: p.slug,
      productName: p.name,
      sku: p.sku,
      colour: p.colour,
      size: line.size,
      imageUrl: p.image?.url ?? null,
      unitPriceCents,
      quantity: line.quantity,
      lineTotalCents: unitPriceCents * line.quantity,
      reservedQuantity,
    };
  });

  const takeByProduct = new Map<number, number>();
  for (const item of items) {
    takeByProduct.set(item.productId, (takeByProduct.get(item.productId) ?? 0) + item.reservedQuantity);
  }
  const totalCents = items.reduce((sum, i) => sum + i.lineTotalCents, 0);

  try {
    await db.batch([
      db.insert(orders).values({
        id: orderId,
        userId: user.id,
        email: user.email,
        subtotalCents: totalCents,
        totalCents,
      }),
      db.insert(orderItems).values(items),
      ...[...takeByProduct]
        .filter(([, take]) => take > 0)
        .map(([productId, take]) =>
          db
            .update(products)
            .set({ stockQuantity: sql`${products.stockQuantity} - ${take}` })
            .where(eq(products.id, productId)),
        ),
    ]);
  } catch (error) {
    const message = `${(error as { cause?: { message?: string } }).cause?.message ?? ""} ${(error as Error).message}`;
    if (message.includes("products_stock_non_negative")) return { ok: false, reason: "stock" };
    throw error;
  }

  return { ok: true, reservation: { orderId, totalCents, items } };
}
