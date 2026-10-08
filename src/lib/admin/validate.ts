// Server-side parsing for admin forms. Every value arrives as a form string
// and is checked here; nothing from the browser is trusted beyond its shape.

export const MAX_STOCK = 100_000;

/** A whole number written plainly ("12", "-3", "+5"), or undefined. No decimals or blanks. */
export function parseWholeNumber(value: FormDataEntryValue | null, { signed = false } = {}) {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  const pattern = signed ? /^[+-]?\d{1,7}$/ : /^\d{1,7}$/;
  if (!pattern.test(trimmed)) return undefined;
  const n = Number(trimmed);
  return Number.isSafeInteger(n) ? n : undefined;
}

export type StockUpdate =
  | { mode: "adjust"; productId: number; delta: number }
  | { mode: "set"; productId: number; quantity: number; expected: number };

export type StockFormErrors = { amount?: string; form?: string };

export function parseStockUpdate(
  formData: FormData,
): { ok: true; update: StockUpdate } | { ok: false; errors: StockFormErrors } {
  const productId = parseWholeNumber(formData.get("productId"));
  if (!productId || productId < 1) return { ok: false, errors: { form: "This product no longer exists." } };

  const mode = formData.get("mode");
  if (mode !== "adjust" && mode !== "set") {
    return { ok: false, errors: { form: "Choose whether to adjust or set the stock." } };
  }

  if (mode === "adjust") {
    const delta = parseWholeNumber(formData.get("amount"), { signed: true });
    if (delta === undefined) return { ok: false, errors: { amount: "Enter a whole number, like 5 or -2." } };
    if (delta === 0) return { ok: false, errors: { amount: "Enter a change other than 0." } };
    if (Math.abs(delta) > MAX_STOCK) {
      return { ok: false, errors: { amount: `Changes are limited to ${MAX_STOCK.toLocaleString("en-US")} at a time.` } };
    }
    return { ok: true, update: { mode, productId, delta } };
  }

  const quantity = parseWholeNumber(formData.get("amount"));
  if (quantity === undefined) return { ok: false, errors: { amount: "Enter a whole number of 0 or more." } };
  if (quantity > MAX_STOCK) {
    return { ok: false, errors: { amount: `Stock can be at most ${MAX_STOCK.toLocaleString("en-US")}.` } };
  }
  const expected = parseWholeNumber(formData.get("expected"));
  if (expected === undefined) {
    return { ok: false, errors: { form: "Reload the page and try again." } };
  }
  return { ok: true, update: { mode, productId, quantity, expected } };
}
