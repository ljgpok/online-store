// Database reads for the admin area. Import only from admin pages and admin
// server actions, after `requireAdmin` (enforced by `pnpm check:admin`).
import "server-only";
import { and, desc, eq, ilike, inArray, or, sql, type SQL } from "drizzle-orm";
import { db } from "./index";
import { LOW_STOCK_THRESHOLD } from "@/lib/stock";
import { categories, orderItems, orders, productImages, products } from "./schema";

const ORDER_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

/** A positive integer id from a route segment, or undefined. */
export function parseNumericId(value: string): number | undefined {
  if (!/^[1-9][0-9]{0,9}$/.test(value)) return undefined;
  const id = Number(value);
  return id <= 2_147_483_647 ? id : undefined;
}

export async function getProductNameForAdmin(id: number) {
  const [row] = await db.select({ name: products.name }).from(products).where(eq(products.id, id));
  return row?.name;
}

export async function getCategoryNameForAdmin(id: number) {
  const [row] = await db.select({ name: categories.name }).from(categories).where(eq(categories.id, id));
  return row?.name;
}

/** Any customer's order: admins see all of them. */
export async function getOrderExistsForAdmin(id: string) {
  if (!ORDER_ID.test(id)) return false;
  const [row] = await db.select({ id: orders.id }).from(orders).where(eq(orders.id, id));
  return Boolean(row);
}

export const STOCK_FILTERS = ["all", "low", "out", "made-to-order"] as const;
export type StockFilter = (typeof STOCK_FILTERS)[number];

export type StockRow = {
  id: number;
  slug: string;
  name: string;
  sku: string;
  category: string;
  image?: string;
  /** `products.stock_quantity`: what customers can still buy. */
  available: number;
  /** Units taken by checkouts that haven't finished (pending or processing). */
  held: number;
  madeToOrder: boolean;
};

/** Escapes LIKE wildcards so a search for "50%" means the text "50%". */
const likeTerm = (q: string) => `%${q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;

export async function listStockForAdmin({ show, q }: { show: StockFilter; q?: string }): Promise<StockRow[]> {
  const held = db
    .select({
      productId: orderItems.productId,
      held: sql<number>`sum(${orderItems.reservedQuantity})::int`.as("held"),
    })
    .from(orderItems)
    .innerJoin(orders, eq(orders.id, orderItems.orderId))
    .where(inArray(orders.status, ["pending_payment", "processing"]))
    .groupBy(orderItems.productId)
    .as("held");

  const conditions: SQL[] = [];
  if (show === "low") {
    conditions.push(sql`${products.stockQuantity} BETWEEN 1 AND ${LOW_STOCK_THRESHOLD}`);
  } else if (show === "out") {
    conditions.push(and(eq(products.stockQuantity, 0), eq(products.madeToOrder, false))!);
  } else if (show === "made-to-order") {
    conditions.push(eq(products.madeToOrder, true));
  }
  const search = q?.trim().slice(0, 80);
  if (search) {
    const term = likeTerm(search);
    conditions.push(or(ilike(products.name, term), ilike(products.sku, term), ilike(products.slug, term))!);
  }

  const rows = await db
    .select({
      id: products.id,
      slug: products.slug,
      name: products.name,
      sku: products.sku,
      category: categories.name,
      available: products.stockQuantity,
      madeToOrder: products.madeToOrder,
      held: sql<number>`coalesce(${held.held}, 0)`,
      image: sql<string | null>`(
        select ${productImages.url} from ${productImages}
        where ${productImages.productId} = ${products.id}
        order by ${productImages.position} limit 1)`,
    })
    .from(products)
    .innerJoin(categories, eq(categories.id, products.categoryId))
    .leftJoin(held, eq(held.productId, products.id))
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(desc(products.createdAt), desc(products.id));

  return rows.map((r) => ({ ...r, held: Number(r.held), image: r.image ?? undefined }));
}
