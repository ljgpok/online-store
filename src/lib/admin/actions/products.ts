"use server";

// Creating and editing products from the admin. Every field is re-validated
// here (src/lib/admin/validate.ts). The product row and its gallery are
// written in one batch, so a failed save leaves nothing half-changed. Stock is
// only set when creating: after that it changes on the Stock page, where
// updates are safe alongside checkouts.
import { eq, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { productImages, products } from "@/db/schema";
import { requireAdmin } from "@/lib/auth/session";
import { parseProductForm, parseWholeNumber, type ProductFormErrors, type ProductInput } from "@/lib/admin/validate";

export type ProductFormState = { ok: false; errors: ProductFormErrors } | null;

export async function createProduct(_prev: ProductFormState, formData: FormData): Promise<ProductFormState> {
  await requireAdmin("/admin/products/new");

  const parsed = parseProductForm(formData, { creating: true });
  if (!parsed.ok) return { ok: false, errors: parsed.errors };
  const product = parsed.product;

  let id: number;
  try {
    const [[created]] = await db.batch([
      db
        .insert(products)
        .values({ ...productColumns(product), stockQuantity: product.stockQuantity ?? 0 })
        .returning({ id: products.id }),
      db.insert(productImages).values(
        product.images.map((image, position) => ({
          productId: sql`(select ${products.id} from ${products} where ${products.slug} = ${product.slug})`,
          url: image.url,
          alt: image.alt,
          position,
        })),
      ),
    ]);
    id = created.id;
  } catch (error) {
    return { ok: false, errors: saveError(error, product) };
  }

  revalidatePath("/admin/products");
  redirect(`/admin/products/${id}?saved=created`);
}

export async function updateProduct(_prev: ProductFormState, formData: FormData): Promise<ProductFormState> {
  await requireAdmin("/admin/products");

  const id = parseWholeNumber(formData.get("productId"));
  if (!id) return { ok: false, errors: { form: "This product no longer exists." } };
  const parsed = parseProductForm(formData, { creating: false });
  if (!parsed.ok) return { ok: false, errors: parsed.errors };
  const product = parsed.product;

  try {
    const [updated] = await db.batch([
      db.update(products).set(productColumns(product)).where(eq(products.id, id)).returning({ id: products.id }),
      db.delete(productImages).where(eq(productImages.productId, id)),
      db.insert(productImages).values(
        product.images.map((image, position) => ({ productId: id, url: image.url, alt: image.alt, position })),
      ),
    ]);
    if (updated.length === 0) return { ok: false, errors: { form: "This product no longer exists." } };
  } catch (error) {
    return { ok: false, errors: saveError(error, product) };
  }

  revalidatePath("/admin/products");
  revalidatePath(`/admin/products/${id}`);
  redirect(`/admin/products/${id}?saved=updated`);
}

function productColumns(p: ProductInput) {
  return {
    name: p.name,
    slug: p.slug,
    sku: p.sku,
    colour: p.colour,
    categoryId: p.categoryId,
    priceCents: p.priceCents,
    salePriceCents: p.salePriceCents,
    sizes: p.sizes,
    sizeGuide: p.sizeGuide,
    madeToOrder: p.madeToOrder,
    stockDetail: p.stockDetail,
    description: p.description,
    details: p.details,
  };
}

/** Turns a database rejection into a message on the field that caused it. */
function saveError(error: unknown, product: ProductInput): ProductFormErrors {
  const message = `${(error as { cause?: { message?: string } }).cause?.message ?? ""} ${(error as Error).message}`;
  if (message.includes("products_slug_unique")) return { slug: `Another product already uses “${product.slug}”.` };
  if (message.includes("products_sku_unique")) return { sku: `Another product already uses ${product.sku}.` };
  if (message.includes("products_category_id_categories_id_fk")) return { categoryId: "That category no longer exists." };
  if (message.includes("product_images_product_id_products_id_fk")) {
    return { form: "This product no longer exists." };
  }
  console.error("[admin products] Save failed", error);
  return { form: "Couldn’t save. Please try again." };
}
