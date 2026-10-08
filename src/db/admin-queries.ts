// Database reads for the admin area. Import only from admin pages and admin
// server actions, after `requireAdmin` (enforced by `pnpm check:admin`).
import "server-only";
import { and, asc, desc, eq, ilike, inArray, or, sql, type SQL } from "drizzle-orm";
import { db } from "./index";
import { LOW_STOCK_THRESHOLD } from "@/lib/stock";
import {
  categories,
  OPEN_STATUSES,
  ORDER_ID_PATTERN,
  orderItems,
  orders,
  productImages,
  products,
  user,
  type OrderStatus,
} from "./schema";

/** A positive integer id from a route segment, or undefined. */
export function parseNumericId(value: string): number | undefined {
  if (!/^[1-9][0-9]{0,9}$/.test(value)) return undefined;
  const id = Number(value);
  return id <= 2_147_483_647 ? id : undefined;
}

export async function getCategoryNameForAdmin(id: number) {
  const [row] = await db.select({ name: categories.name }).from(categories).where(eq(categories.id, id));
  return row?.name;
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
    .where(inArray(orders.status, [...OPEN_STATUSES]))
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

// ─── Products ────────────────────────────────────────────────────────────────

export type ProductListRow = {
  id: number;
  slug: string;
  name: string;
  sku: string;
  colour: string;
  category: string;
  priceCents: number;
  salePriceCents: number | null;
  stockQuantity: number;
  madeToOrder: boolean;
  image?: string;
};

export async function listProductsForAdmin({ q }: { q?: string } = {}): Promise<ProductListRow[]> {
  const search = q?.trim().slice(0, 80);
  const term = search ? likeTerm(search) : undefined;
  const rows = await db
    .select({
      id: products.id,
      slug: products.slug,
      name: products.name,
      sku: products.sku,
      colour: products.colour,
      category: categories.name,
      priceCents: products.priceCents,
      salePriceCents: products.salePriceCents,
      stockQuantity: products.stockQuantity,
      madeToOrder: products.madeToOrder,
      image: sql<string | null>`(
        select ${productImages.url} from ${productImages}
        where ${productImages.productId} = ${products.id}
        order by ${productImages.position} limit 1)`,
    })
    .from(products)
    .innerJoin(categories, eq(categories.id, products.categoryId))
    .where(term ? or(ilike(products.name, term), ilike(products.sku, term), ilike(products.slug, term)) : undefined)
    .orderBy(desc(products.createdAt), desc(products.id));
  return rows.map((r) => ({ ...r, image: r.image ?? undefined }));
}

/** Everything the product form edits, in the form's own units (cents, arrays). */
export async function getProductForAdmin(id: number) {
  return db.query.products.findFirst({
    columns: { createdAt: false },
    with: { images: { columns: { url: true, alt: true }, orderBy: [asc(productImages.position)] } },
    where: eq(products.id, id),
  });
}
export type AdminProduct = NonNullable<Awaited<ReturnType<typeof getProductForAdmin>>>;

export async function listCategoryOptionsForAdmin() {
  return db.select({ id: categories.id, name: categories.name }).from(categories).orderBy(asc(categories.position));
}

// ─── Orders ──────────────────────────────────────────────────────────────────

/** Filters on the orders list. "open" holds stock; "closed" never charged anything. */
export const ORDER_FILTERS = ["all", "paid", "open", "review", "closed"] as const;
export type OrderFilter = (typeof ORDER_FILTERS)[number];

const statusesFor: Record<Exclude<OrderFilter, "all">, readonly OrderStatus[]> = {
  paid: ["paid"],
  open: OPEN_STATUSES,
  review: ["needs_review"],
  closed: ["payment_failed", "expired", "cancelled"],
};

export type AdminOrderRow = {
  id: string;
  status: OrderStatus;
  email: string;
  customerName: string | null;
  createdAt: Date;
  paidAt: Date | null;
  totalCents: number;
  itemCount: number;
};

export async function listOrdersForAdmin({ show, q }: { show: OrderFilter; q?: string }): Promise<AdminOrderRow[]> {
  const conditions: SQL[] = [];
  if (show !== "all") conditions.push(inArray(orders.status, [...statusesFor[show]]));
  const search = q?.trim().slice(0, 80);
  if (search) {
    const term = likeTerm(search);
    // Order reference (the id's first characters) or the customer's email.
    conditions.push(or(ilike(sql`${orders.id}::text`, `${search.toLowerCase().replace(/[\\%_]/g, "")}%`), ilike(orders.email, term))!);
  }
  const rows = await db
    .select({
      id: orders.id,
      status: orders.status,
      email: orders.email,
      customerName: user.name,
      createdAt: orders.createdAt,
      paidAt: orders.paidAt,
      totalCents: orders.totalCents,
      itemCount: sql<number>`(select coalesce(sum(${orderItems.quantity}), 0)::int from ${orderItems} where ${orderItems.orderId} = ${orders.id})`,
    })
    .from(orders)
    .leftJoin(user, eq(user.id, orders.userId))
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(desc(orders.createdAt))
    .limit(200);
  return rows.map((r) => ({ ...r, itemCount: Number(r.itemCount) }));
}

/** Any customer's order with its lines and the account that placed it. */
export async function getOrderForAdmin(id: string) {
  if (!ORDER_ID_PATTERN.test(id)) return undefined;
  const row = await db.query.orders.findFirst({
    where: eq(orders.id, id),
    with: {
      user: { columns: { id: true, name: true, email: true } },
      items: { orderBy: (i, { asc }) => [asc(i.id)] },
    },
  });
  return row;
}
export type AdminOrder = NonNullable<Awaited<ReturnType<typeof getOrderForAdmin>>>;
