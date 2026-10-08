"use server";

// Every bag change goes through here. Each action re-reads the product from
// the database and enforces size and stock rules; the client's numbers are
// never trusted. Writing the cookie re-renders the page and header.
import { getCartProductBySlug, getCartProducts, type CartProduct } from "@/db/queries";
import { MAX_LINE_QUANTITY, maxOrderable } from "@/lib/stock";
import { lineKey, readCartLines, writeCartLines, type StoredLine } from "./cookie";
import { isValidSize } from "./server";
import type { CartActionResult } from "./types";

const MAX_SLUG_LENGTH = 200;

function field(formData: FormData, name: string) {
  const value = formData.get(name);
  return typeof value === "string" ? value : "";
}

function intField(formData: FormData, name: string) {
  const value = Number(field(formData, name));
  return Number.isSafeInteger(value) ? value : NaN;
}

const totalFor = (lines: StoredLine[], productId: number, exceptSize?: string) =>
  lines
    .filter((l) => l.productId === productId && l.size !== exceptSize)
    .reduce((sum, l) => sum + l.quantity, 0);

function limitMessage(product: CartProduct, available: number, inBag: number) {
  if (product.madeToOrder || available === MAX_LINE_QUANTITY) {
    return `You can have up to ${MAX_LINE_QUANTITY} of this piece in your bag.`;
  }
  const left = `Only ${available} available`;
  return inBag > 0 ? `${left}, and you have ${inBag} in your bag.` : `${left}.`;
}

export async function addToBag(
  _prev: CartActionResult | null,
  formData: FormData,
): Promise<CartActionResult> {
  const slug = field(formData, "slug");
  const size = field(formData, "size");
  if (!slug || slug.length > MAX_SLUG_LENGTH) {
    return { ok: false, error: "This piece is no longer available." };
  }

  const product = await getCartProductBySlug(slug);
  if (!product) return { ok: false, error: "This piece is no longer available." };
  if (product.sizes.length > 0 && !size) {
    return { ok: false, error: "Select a size to add this to your bag." };
  }
  if (!isValidSize(product, size)) {
    return { ok: false, error: "That size isn’t available. Choose another." };
  }

  const available = maxOrderable(product.stockQuantity, product.madeToOrder);
  if (available === 0) return { ok: false, error: "This piece is sold out." };

  const lines = await readCartLines();
  const inBag = totalFor(lines, product.id);
  if (inBag + 1 > available) {
    return { ok: false, error: limitMessage(product, available, inBag) };
  }

  const key = lineKey(product.id, size);
  const existing = lines.find((l) => lineKey(l.productId, l.size) === key);
  if (existing) existing.quantity += 1;
  else lines.push({ productId: product.id, size, quantity: 1 });
  await writeCartLines(lines);

  return {
    ok: true,
    message: size ? `${product.name}, size ${size}` : product.name,
  };
}

export async function updateQuantity(
  _prev: CartActionResult | null,
  formData: FormData,
): Promise<CartActionResult> {
  const productId = intField(formData, "productId");
  const size = field(formData, "size");
  const quantity = intField(formData, "quantity");
  if (!(productId > 0) || Number.isNaN(quantity)) {
    return { ok: false, error: "Something went wrong. Refresh the page and try again." };
  }

  const lines = await readCartLines();
  const key = lineKey(productId, size);
  const line = lines.find((l) => lineKey(l.productId, l.size) === key);
  if (!line) return { ok: false, error: "That item is no longer in your bag." };

  const [product] = await getCartProducts([productId]);
  if (!product || !isValidSize(product, size) || quantity < 1) {
    await writeCartLines(lines.filter((l) => l !== line));
    return { ok: true };
  }

  // Lowering is always allowed, so a line over the limit can be fixed.
  const available = maxOrderable(product.stockQuantity, product.madeToOrder);
  const others = totalFor(lines, productId, size);
  if (quantity > line.quantity && others + quantity > available) {
    return { ok: false, error: limitMessage(product, available, others + line.quantity) };
  }

  line.quantity = Math.min(quantity, MAX_LINE_QUANTITY);
  await writeCartLines(lines);
  return { ok: true };
}

export async function removeLine(
  _prev: CartActionResult | null,
  formData: FormData,
): Promise<CartActionResult> {
  const productId = intField(formData, "productId");
  const size = field(formData, "size");
  const lines = await readCartLines();
  const key = lineKey(productId, size);
  await writeCartLines(lines.filter((l) => lineKey(l.productId, l.size) !== key));
  return { ok: true };
}
