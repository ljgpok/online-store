// Database reads for the admin area. Import only from admin pages and admin
// server actions, after `requireAdmin` (enforced by `pnpm check:admin`).
import "server-only";
import { eq } from "drizzle-orm";
import { db } from "./index";
import { categories, orders, products } from "./schema";

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
