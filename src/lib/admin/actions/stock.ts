"use server";

// Stock changes from the admin Stock page. Each is one conditional UPDATE,
// never a read-then-write, so it composes safely with checkout reservations
// and releases happening at the same moment.
import { and, eq, gte, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { products } from "@/db/schema";
import { requireAdmin } from "@/lib/auth/session";
import { parseStockUpdate, type StockFormErrors } from "@/lib/admin/validate";

export type StockActionState =
  | { ok: true; available: number; message: string }
  | { ok: false; errors: StockFormErrors; current?: number };

export async function updateStock(
  _prev: StockActionState | null,
  formData: FormData,
): Promise<StockActionState> {
  await requireAdmin("/admin/stock");

  const parsed = parseStockUpdate(formData);
  if (!parsed.ok) return { ok: false, errors: parsed.errors };
  const update = parsed.update;

  let updated: { available: number }[];
  try {
    if (update.mode === "adjust") {
      // Relative, so reservations landing at the same time still count.
      updated = await db
        .update(products)
        .set({ stockQuantity: sql`${products.stockQuantity} + ${update.delta}` })
        .where(and(eq(products.id, update.productId), gte(sql`${products.stockQuantity} + ${update.delta}`, 0)))
        .returning({ available: products.stockQuantity });
    } else {
      if (update.quantity === update.expected) {
        return { ok: true, available: update.expected, message: "No change." };
      }
      // Compare-and-set: only if nothing changed since the admin loaded the page.
      updated = await db
        .update(products)
        .set({ stockQuantity: update.quantity })
        .where(and(eq(products.id, update.productId), eq(products.stockQuantity, update.expected)))
        .returning({ available: products.stockQuantity });
    }
  } catch (error) {
    console.error(`[admin stock] Update failed for product ${update.productId}`, error);
    return { ok: false, errors: { form: "Couldn’t save. Please try again." } };
  }

  revalidatePath("/admin/stock");

  if (updated.length === 1) {
    const { available } = updated[0];
    return { ok: true, available, message: `Saved. Available is now ${available}.` };
  }

  // Nothing matched: say why, from the current value.
  const [row] = await db
    .select({ available: products.stockQuantity })
    .from(products)
    .where(eq(products.id, update.productId));
  if (!row) return { ok: false, errors: { form: "This product no longer exists." } };
  if (update.mode === "adjust") {
    return {
      ok: false,
      current: row.available,
      errors: { amount: `Only ${row.available} available, so you can remove at most ${row.available}.` },
    };
  }
  return {
    ok: false,
    current: row.available,
    errors: {
      form: `Stock changed to ${row.available} since you loaded this page (a customer may have reserved or paid). Check it and try again.`,
    },
  };
}
