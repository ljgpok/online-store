import "server-only";
import { asc, count, desc, eq } from "drizzle-orm";
import { cache } from "react";
import type { CategorySummary, Product } from "@/lib/products";
import { db } from "./index";
import { categories, productImages, products } from "./schema";

type ProductRow = typeof products.$inferSelect & {
  category: typeof categories.$inferSelect;
  images: (typeof productImages.$inferSelect)[];
};

const withRelations = {
  category: true as const,
  images: { orderBy: [asc(productImages.position)] },
};

const newestFirst = [desc(products.createdAt), desc(products.id)];

const categoryHref = (slug: string) => `/${slug}`;

/**
 * Maps a database row to the shape the storefront components use.
 * The only place cents become dollars.
 */
export function mapProduct(row: ProductRow): Product {
  return {
    slug: row.slug,
    sku: row.sku,
    name: row.name,
    colour: row.colour,
    category: {
      name: row.category.name,
      href: categoryHref(row.category.slug),
    },
    price: row.priceCents / 100,
    salePrice:
      row.salePriceCents === null ? undefined : row.salePriceCents / 100,
    images: row.images.map((image) => ({ src: image.url, alt: image.alt })),
    description: row.description,
    details: row.details,
    sizes: row.sizes,
    sizeGuide: row.sizeGuide ?? undefined,
    stock: row.stockQuantity,
    madeToOrder: row.madeToOrder,
    stockDetail: row.stockDetail ?? undefined,
  };
}

export const getNewArrivals = cache(async (limit = 8) => {
  const rows = await db.query.products.findMany({
    with: withRelations,
    orderBy: newestFirst,
    limit,
  });
  return rows.map(mapProduct);
});

export const getProductBySlug = cache(async (slug: string) => {
  const row = await db.query.products.findFirst({
    where: eq(products.slug, slug),
    with: withRelations,
  });
  return row ? mapProduct(row) : undefined;
});

/** Same category first, then the rest of the catalogue, never the product itself. */
export const getRelatedProducts = cache(async (product: Product, limit = 4) => {
  const rows = await db.query.products.findMany({
    with: withRelations,
    orderBy: newestFirst,
  });
  const others = rows.map(mapProduct).filter((p) => p.slug !== product.slug);
  const sameCategory = others.filter(
    (p) => p.category.href === product.category.href,
  );
  const rest = others.filter((p) => p.category.href !== product.category.href);
  return [...sameCategory, ...rest].slice(0, limit);
});

/** Category tiles in display order, with how many products each holds. */
export const getCategoriesWithCounts = cache(
  async (): Promise<CategorySummary[]> => {
    const rows = await db
      .select({
        slug: categories.slug,
        name: categories.name,
        imageUrl: categories.imageUrl,
        imageAlt: categories.imageAlt,
        productCount: count(products.id),
      })
      .from(categories)
      .leftJoin(products, eq(products.categoryId, categories.id))
      .groupBy(categories.id)
      .orderBy(asc(categories.position), asc(categories.name));

    return rows.map((row) => ({
      slug: row.slug,
      name: row.name,
      href: categoryHref(row.slug),
      image: row.imageUrl
        ? { src: row.imageUrl, alt: row.imageAlt ?? "" }
        : undefined,
      productCount: row.productCount,
    }));
  },
);
