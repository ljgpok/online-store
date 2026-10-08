// The bag lives in an httpOnly cookie that holds only product ids, sizes and
// quantities. Prices and stock are always read fresh from the database, so
// nothing in the cookie is trusted: it's parsed defensively and re-checked.
import "server-only";
import { cookies } from "next/headers";
import { MAX_LINE_QUANTITY } from "@/lib/stock";

export type StoredLine = { productId: number; size: string; quantity: number };

const COOKIE = "cart";
const VERSION = 1;
const MAX_LINES = 30;
const MAX_SIZE_LENGTH = 20;
const MAX_AGE = 60 * 60 * 24 * 30; // 30 days

export const lineKey = (productId: number, size: string) => `${productId}:${size}`;

/** Bad JSON, an unknown version or malformed lines all read as an empty bag. */
export function parseCart(raw: string | undefined): StoredLine[] {
  if (!raw) return [];
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return [];
  }
  if (typeof data !== "object" || data === null) return [];
  const { v, items } = data as { v?: unknown; items?: unknown };
  if (v !== VERSION || !Array.isArray(items)) return [];

  // Merge duplicates so each product and size appears once.
  const lines = new Map<string, StoredLine>();
  for (const item of items.slice(0, MAX_LINES)) {
    if (typeof item !== "object" || item === null) continue;
    const { p, s, q } = item as { p?: unknown; s?: unknown; q?: unknown };
    if (!Number.isSafeInteger(p) || (p as number) < 1) continue;
    if (typeof s !== "string" || s.length > MAX_SIZE_LENGTH) continue;
    if (!Number.isSafeInteger(q) || (q as number) < 1) continue;
    const key = lineKey(p as number, s);
    const quantity = Math.min((lines.get(key)?.quantity ?? 0) + (q as number), MAX_LINE_QUANTITY);
    lines.set(key, { productId: p as number, size: s, quantity });
  }
  return [...lines.values()];
}

export async function readCartLines(): Promise<StoredLine[]> {
  return parseCart((await cookies()).get(COOKIE)?.value);
}

/**
 * The order this bag was last checked out as, if the bag hasn't changed since.
 * Lets a confirmed order clear exactly the bag that became it, and nothing newer.
 */
export async function readCartOrderId(): Promise<string | undefined> {
  const raw = (await cookies()).get(COOKIE)?.value;
  if (!raw) return undefined;
  try {
    const { o } = JSON.parse(raw) as { o?: unknown };
    return typeof o === "string" && o.length <= 64 ? o : undefined;
  } catch {
    return undefined;
  }
}

/**
 * Only callable from server actions and route handlers. Any edit drops the
 * order mark, because the bag no longer matches that order.
 */
export async function writeCartLines(lines: StoredLine[], orderId?: string) {
  const store = await cookies();
  if (lines.length === 0) {
    store.delete(COOKIE);
    return;
  }
  const value = JSON.stringify({
    v: VERSION,
    items: lines.slice(0, MAX_LINES).map((l) => ({ p: l.productId, s: l.size, q: l.quantity })),
    ...(orderId ? { o: orderId } : {}),
  });
  store.set(COOKIE, value, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: MAX_AGE,
  });
}
