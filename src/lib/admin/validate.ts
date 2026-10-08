// Server-side parsing for admin forms. Every value arrives as a form string
// and is checked here; nothing from the browser is trusted beyond its shape.

export const MAX_STOCK = 100_000;

/** A whole number written plainly ("12", "-3", "+5"), or undefined. No decimals or blanks. */
export function parseWholeNumber(value: FormDataEntryValue | null, { signed = false } = {}) {
  if (typeof value !== "string") return undefined;
  // Accept the typographic minus (U+2212) the form's placeholder shows.
  const trimmed = value.trim().replace(/^−/, "-");
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

// ─── Products ────────────────────────────────────────────────────────────────

/** Gallery rows the product form offers. Blank rows are ignored. */
export const PRODUCT_IMAGE_SLOTS = 6;
/** Product photos must come from a host `next.config.ts` allows for next/image. */
export const PRODUCT_IMAGE_HOSTS = ["images.unsplash.com"];
/** Matches the bag cookie's limit, so every offered size fits in a bag line. */
const MAX_SIZE_LENGTH = 20;

export type ProductInput = {
  name: string;
  slug: string;
  sku: string;
  colour: string;
  categoryId: number;
  priceCents: number;
  salePriceCents: number | null;
  sizes: string[];
  sizeGuide: string | null;
  madeToOrder: boolean;
  stockDetail: string | null;
  description: string;
  details: string[];
  images: { url: string; alt: string }[];
  /** Only when creating; existing stock changes on the Stock page. */
  stockQuantity?: number;
};

export type ProductField =
  | "name"
  | "slug"
  | "sku"
  | "colour"
  | "categoryId"
  | "price"
  | "salePrice"
  | "sizes"
  | "sizeGuide"
  | "stockDetail"
  | "description"
  | "details"
  | "images"
  | "stock"
  | "form";
export type ProductFormErrors = Partial<Record<ProductField, string>>;

const text = (formData: FormData, name: string) => {
  const value = formData.get(name);
  return typeof value === "string" ? value.trim() : "";
};

/** "1250", "1,250" or "1250.50" dollars as cents, or undefined. */
export function parseDollars(value: string): number | undefined {
  const plain = value.replace(/[$,\s]/g, "");
  if (!/^\d{1,7}(\.\d{1,2})?$/.test(plain)) return undefined;
  const [whole, fraction = ""] = plain.split(".");
  return Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
}

function isAllowedImageUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && PRODUCT_IMAGE_HOSTS.includes(url.hostname);
  } catch {
    return false;
  }
}

export function parseProductForm(
  formData: FormData,
  { creating }: { creating: boolean },
): { ok: true; product: ProductInput } | { ok: false; errors: ProductFormErrors } {
  const errors: ProductFormErrors = {};

  const name = text(formData, "name");
  if (!name) errors.name = "Enter a name.";
  else if (name.length > 120) errors.name = "Keep the name under 120 characters.";

  const slug = text(formData, "slug").toLowerCase();
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug) || slug.length > 80) {
    errors.slug = "Use lowercase letters, numbers and single hyphens, like wool-overcoat.";
  }

  const sku = text(formData, "sku").toUpperCase();
  if (!/^[A-Z0-9][A-Z0-9-]{1,39}$/.test(sku)) errors.sku = "Use letters, numbers and hyphens, like CS-1014.";

  const colour = text(formData, "colour");
  if (!colour) errors.colour = "Enter a colour.";
  else if (colour.length > 60) errors.colour = "Keep the colour under 60 characters.";

  const categoryId = parseWholeNumber(formData.get("categoryId"));
  if (!categoryId) errors.categoryId = "Choose a category.";

  const priceCents = parseDollars(text(formData, "price"));
  if (priceCents === undefined || priceCents === 0) errors.price = "Enter a price in dollars, like 1250 or 1250.50.";

  const saleRaw = text(formData, "salePrice");
  let salePriceCents: number | null = null;
  if (saleRaw) {
    const sale = parseDollars(saleRaw);
    if (sale === undefined) errors.salePrice = "Enter a sale price in dollars, or leave it empty.";
    else if (priceCents !== undefined && sale >= priceCents) errors.salePrice = "The sale price must be lower than the price.";
    else salePriceCents = sale;
  }

  const sizes = [...new Set(text(formData, "sizes").split(",").map((s) => s.trim()).filter(Boolean))];
  if (sizes.length > 20) errors.sizes = "List at most 20 sizes.";
  else if (sizes.some((s) => s.length > MAX_SIZE_LENGTH)) errors.sizes = `Each size must be ${MAX_SIZE_LENGTH} characters or fewer.`;

  const sizeGuide = text(formData, "sizeGuide");
  if (sizeGuide.length > 300) errors.sizeGuide = "Keep the size note under 300 characters.";

  const madeToOrder = formData.get("madeToOrder") === "on";
  const stockDetail = text(formData, "stockDetail");
  if (stockDetail.length > 200) errors.stockDetail = "Keep the availability note under 200 characters.";

  const description = text(formData, "description");
  if (!description) errors.description = "Enter a description.";
  else if (description.length > 2000) errors.description = "Keep the description under 2,000 characters.";

  const details = text(formData, "details").split("\n").map((d) => d.trim()).filter(Boolean);
  if (details.length > 20) errors.details = "List at most 20 details.";
  else if (details.some((d) => d.length > 200)) errors.details = "Keep each detail under 200 characters.";

  const images: { url: string; alt: string }[] = [];
  for (let i = 0; i < PRODUCT_IMAGE_SLOTS; i++) {
    const url = text(formData, `imageUrl${i}`);
    const alt = text(formData, `imageAlt${i}`);
    if (!url && !alt) continue;
    if (!isAllowedImageUrl(url)) {
      errors.images = `Image ${i + 1}: use an https link from ${PRODUCT_IMAGE_HOSTS.join(" or ")}.`;
      break;
    }
    if (!alt || alt.length > 200) {
      errors.images = `Image ${i + 1}: describe the photo in under 200 characters, for people who can’t see it.`;
      break;
    }
    images.push({ url, alt });
  }
  if (!errors.images && images.length === 0) errors.images = "Add at least one image. The first one is the product card photo.";

  let stockQuantity: number | undefined;
  if (creating) {
    stockQuantity = parseWholeNumber(formData.get("stock"));
    if (stockQuantity === undefined || stockQuantity > MAX_STOCK) {
      errors.stock = `Enter starting stock as a whole number from 0 to ${MAX_STOCK.toLocaleString("en-US")}.`;
    }
  }

  if (Object.keys(errors).length > 0) return { ok: false, errors };
  return {
    ok: true,
    product: {
      name,
      slug,
      sku,
      colour,
      categoryId: categoryId!,
      priceCents: priceCents!,
      salePriceCents,
      sizes,
      sizeGuide: sizeGuide || null,
      madeToOrder,
      stockDetail: stockDetail || null,
      description,
      details,
      images,
      ...(creating ? { stockQuantity } : {}),
    },
  };
}
