// Loads the starting catalogue: `pnpm db:seed`. Safe to re-run: categories and
// products are upserted by slug, each seeded product's images are
// replaced, and categories no longer in the seed are removed once nothing uses them.
import "./load-env";
import {
  and,
  count,
  inArray,
  notExists,
  notInArray,
  sql,
  type Column,
  type SQL,
} from "drizzle-orm";
import { db } from "./index";
import { categories, productImages, products } from "./schema";
import { seedCategories, seedProducts } from "./seed-data";

// Upserts take the incoming row's value for a column.
const excluded = (column: Column) => sql.raw(`excluded."${column.name}"`);

const categoryIdFor = (slug: string) =>
  sql`(select ${categories.id} from ${categories} where ${categories.slug} = ${slug})`;
const productIdFor = (slug: string) =>
  sql`(select ${products.id} from ${products} where ${products.slug} = ${slug})`;

const productSlugs = seedProducts.map((p) => p.slug);
const categorySlugs = seedCategories.map((c) => c.slug);
const seededProductIds = db
  .select({ id: products.id })
  .from(products)
  .where(inArray(products.slug, productSlugs));

// Arrival dates one day apart from a fixed base, so New arrivals keeps the seed
// order however many times the seed runs.
const ARRIVALS_BASE = Date.UTC(2026, 8, 1, 9);
const DAY = 24 * 60 * 60 * 1000;

type ChildRow = { productId: SQL; position: number };

const imageRows = seedProducts.flatMap<ChildRow & { url: string; alt: string }>(
  (p) =>
    p.images.map((image, position) => ({
      productId: productIdFor(p.slug),
      url: image.src,
      alt: image.alt,
      position,
    })),
);

async function main() {
  // neon-http runs a batch as a single transaction, so the seed applies fully or not at all.
  await db.batch([
    db
      .insert(categories)
      .values(
        seedCategories.map((c, position) => ({
          slug: c.slug,
          name: c.name,
          imageUrl: c.image.src,
          imageAlt: c.image.alt,
          position,
        })),
      )
      .onConflictDoUpdate({
        target: categories.slug,
        set: {
          name: excluded(categories.name),
          imageUrl: excluded(categories.imageUrl),
          imageAlt: excluded(categories.imageAlt),
          position: excluded(categories.position),
        },
      }),

    db
      .insert(products)
      .values(
        seedProducts.map((p, i) => ({
          slug: p.slug,
          sku: p.sku,
          name: p.name,
          colour: p.colour,
          description: p.description,
          details: p.details,
          categoryId: categoryIdFor(p.categorySlug),
          priceCents: p.priceCents,
          salePriceCents: p.salePriceCents ?? null,
          sizes: p.sizes ?? [],
          sizeGuide: p.sizeGuide ?? null,
          stockQuantity: p.stock,
          madeToOrder: p.madeToOrder ?? false,
          stockDetail: p.stockDetail ?? null,
          createdAt: new Date(ARRIVALS_BASE - i * DAY),
        })),
      )
      .onConflictDoUpdate({
        target: products.slug,
        set: {
          sku: excluded(products.sku),
          name: excluded(products.name),
          colour: excluded(products.colour),
          description: excluded(products.description),
          details: excluded(products.details),
          categoryId: excluded(products.categoryId),
          priceCents: excluded(products.priceCents),
          salePriceCents: excluded(products.salePriceCents),
          sizes: excluded(products.sizes),
          sizeGuide: excluded(products.sizeGuide),
          stockQuantity: excluded(products.stockQuantity),
          madeToOrder: excluded(products.madeToOrder),
          stockDetail: excluded(products.stockDetail),
          createdAt: excluded(products.createdAt),
        },
      }),

    db
      .delete(productImages)
      .where(inArray(productImages.productId, seededProductIds)),
    db.insert(productImages).values(imageRows),

    // Categories dropped from the seed (such as a renamed one), once no product uses them.
    db.delete(categories).where(
      and(
        notInArray(categories.slug, categorySlugs),
        notExists(
          db
            .select({ id: products.id })
            .from(products)
            .where(sql`${products.categoryId} = ${categories.id}`),
        ),
      ),
    ),
  ]);

  const [[c], [p], [i]] = await db.batch([
    db.select({ n: count() }).from(categories),
    db.select({ n: count() }).from(products),
    db.select({ n: count() }).from(productImages),
  ]);
  console.log(`Seeded: ${c.n} categories, ${p.n} products, ${i.n} images.`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
