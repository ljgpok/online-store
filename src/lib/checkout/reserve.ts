// Turns a validated bag into an order and takes its stock, in one database
// transaction. Prices come from the product rows read here, never from the
// client. If another shopper took the stock first, the products CHECK
// (stock_quantity >= 0) fails and the whole batch rolls back. Made-to-order
// pieces never fail that way: they take whatever is on the shelf at the time.
import "server-only";
import { eq, inArray, sql } from "drizzle-orm";
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

  const items = lines.map((line) => {
    const p = productsById.get(line.productId)!;
    const unitPriceCents = p.salePriceCents ?? p.priceCents;
    // Made-to-order lines take only what's on the shelf, worked out in the
    // batch below from current stock; this is replaced with what was taken.
    const reservedQuantity = p.madeToOrder ? 0 : line.quantity;
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

  const madeToOrder = (productId: number) => productsById.get(productId)!.madeToOrder;
  const madeToOrderIds = [...new Set(items.map((i) => i.productId).filter(madeToOrder))];
  const madeToOrderItems = items.filter((i) => madeToOrder(i.productId));
  const stockItems = items.filter((i) => !madeToOrder(i.productId));

  const takeByProduct = new Map<number, number>();
  for (const item of stockItems) {
    takeByProduct.set(item.productId, (takeByProduct.get(item.productId) ?? 0) + item.reservedQuantity);
  }
  const totalCents = items.reduce((sum, i) => sum + i.lineTotalCents, 0);

  // Units this order has already taken of a product, from the lines inserted so far.
  const takenSoFar = (productId: number) =>
    sql`(select coalesce(sum(${orderItems.reservedQuantity}), 0) from ${orderItems}
      where ${orderItems.orderId} = ${orderId} and ${orderItems.productId} = ${productId})`;

  // Locks made-to-order rows until the batch commits, so the shelf amounts
  // worked out below can't be taken by another checkout in between. The stock
  // read when the bag was checked may already be out of date.
  const lock = madeToOrderIds.length
    ? [
        db
          .select({ id: products.id })
          .from(products)
          .where(inArray(products.id, madeToOrderIds))
          .orderBy(products.id)
          .for("update"),
      ]
    : [];

  let taken: { reservedQuantity: number }[][];
  try {
    const results = await db.batch([
      db.insert(orders).values({
        id: orderId,
        userId: user.id,
        email: user.email,
        subtotalCents: totalCents,
        totalCents,
      }),
      ...lock,
      ...(stockItems.length ? [db.insert(orderItems).values(stockItems)] : []),
      // One insert per made-to-order line, in bag order: each takes what's
      // left on the shelf after the lines before it, and none if it's empty.
      ...madeToOrderItems.map((item) =>
        db
          .insert(orderItems)
          .values({
            ...item,
            reservedQuantity: sql`least(${item.quantity}, greatest(0,
              (select ${products.stockQuantity} from ${products} where ${products.id} = ${item.productId})
              - ${takenSoFar(item.productId)}))`,
          })
          .returning({ reservedQuantity: orderItems.reservedQuantity }),
      ),
      ...[...takeByProduct]
        .filter(([, take]) => take > 0)
        .map(([productId, take]) =>
          db
            .update(products)
            .set({ stockQuantity: sql`${products.stockQuantity} - ${take}` })
            .where(eq(products.id, productId)),
        ),
      ...madeToOrderIds.map((productId) =>
        db
          .update(products)
          .set({ stockQuantity: sql`${products.stockQuantity} - ${takenSoFar(productId)}` })
          .where(eq(products.id, productId)),
      ),
    ]);
    const first = 1 + lock.length + (stockItems.length ? 1 : 0);
    taken = results.slice(first, first + madeToOrderItems.length) as typeof taken;
  } catch (error) {
    const message = `${(error as { cause?: { message?: string } }).cause?.message ?? ""} ${(error as Error).message}`;
    if (message.includes("products_stock_non_negative")) return { ok: false, reason: "stock" };
    throw error;
  }

  madeToOrderItems.forEach((item, i) => {
    item.reservedQuantity = taken[i][0].reservedQuantity;
  });
  return { ok: true, reservation: { orderId, totalCents, items } };
}
