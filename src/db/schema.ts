import { relations, sql } from "drizzle-orm";
import {
  boolean,
  check,
  index,
  integer,
  pgTable,
  smallint,
  text,
  timestamp,
  unique,
} from "drizzle-orm/pg-core";

// Better Auth tables live in auth-schema.ts and are re-exported here, so
// drizzle-kit and the db client see one schema.
export * from "./auth-schema";

export const categories = pgTable("categories", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  /** Tile image on the homepage. */
  imageUrl: text("image_url"),
  imageAlt: text("image_alt"),
  /** Display order of category tiles. */
  position: smallint("position").notNull().default(0),
});

export const products = pgTable(
  "products",
  {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
    slug: text("slug").notNull().unique(),
    sku: text("sku").notNull().unique(),
    name: text("name").notNull(),
    colour: text("colour").notNull(),
    description: text("description").notNull(),
    details: text("details").array().notNull().default(sql`'{}'::text[]`),
    categoryId: integer("category_id")
      .notNull()
      .references(() => categories.id, { onDelete: "restrict" }),
    priceCents: integer("price_cents").notNull(),
    salePriceCents: integer("sale_price_cents"),
    /** Sizes offered, in display order. Empty for one-size products. */
    sizes: text("sizes").array().notNull().default(sql`'{}'::text[]`),
    sizeGuide: text("size_guide"),
    /** Units in stock for the whole product, across all sizes. */
    stockQuantity: integer("stock_quantity").notNull().default(0),
    /** When out of stock, the product can still be ordered and is made for the customer. */
    madeToOrder: boolean("made_to_order").notNull().default(false),
    /** Extra availability note, such as lead time for made-to-order pieces. */
    stockDetail: text("stock_detail"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("products_category_id_idx").on(t.categoryId),
    index("products_created_at_idx").on(t.createdAt.desc()),
    check("products_price_non_negative", sql`${t.priceCents} >= 0`),
    check("products_stock_non_negative", sql`${t.stockQuantity} >= 0`),
    check(
      "products_sale_below_price",
      sql`${t.salePriceCents} IS NULL OR (${t.salePriceCents} >= 0 AND ${t.salePriceCents} < ${t.priceCents})`,
    ),
  ],
);

// Gallery images in display order. Position 0 is the product card image.
export const productImages = pgTable(
  "product_images",
  {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
    productId: integer("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    url: text("url").notNull(),
    alt: text("alt").notNull(),
    position: smallint("position").notNull().default(0),
  },
  (t) => [unique("product_images_product_position_unique").on(t.productId, t.position)],
);

export const categoriesRelations = relations(categories, ({ many }) => ({
  products: many(products),
}));

export const productsRelations = relations(products, ({ one, many }) => ({
  category: one(categories, {
    fields: [products.categoryId],
    references: [categories.id],
  }),
  images: many(productImages),
}));

export const productImagesRelations = relations(productImages, ({ one }) => ({
  product: one(products, {
    fields: [productImages.productId],
    references: [products.id],
  }),
}));
