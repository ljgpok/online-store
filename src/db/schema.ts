import { relations, sql } from "drizzle-orm";
import {
  boolean,
  check,
  index,
  integer,
  jsonb,
  pgTable,
  smallint,
  text,
  timestamp,
  unique,
} from "drizzle-orm/pg-core";

// Better Auth tables live in auth-schema.ts and are re-exported here, so
// drizzle-kit and the db client see one schema.
export * from "./auth-schema";
import { user } from "./auth-schema";

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

// ---------------------------------------------------------------------------
// Checkout. Orders belong to a signed-in customer. Prices are copied from
// `products` when checkout starts; Stripe only ever sees these snapshots.

/**
 * Our lifecycle for an order, changed only by `src/lib/checkout/orders.ts`.
 * - pending_payment: stock reserved, Stripe Checkout Session open
 * - processing: Stripe accepted a delayed payment method; funds not yet confirmed
 * - paid: payment confirmed by Stripe (webhook or server-side session read)
 * - payment_failed: a delayed payment failed; stock returned
 * - expired: the Checkout Session expired unpaid; stock returned
 * - cancelled: replaced by a newer checkout, or creating the session failed; stock returned
 * - needs_review: Stripe reported payment, but amount or currency didn't match the order
 */
export const ORDER_STATUSES = [
  "pending_payment",
  "processing",
  "paid",
  "payment_failed",
  "expired",
  "cancelled",
  "needs_review",
] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

/** Stripe has taken (or is taking) the payment, so the bag has become this order. */
export const CONFIRMED_STATUSES = ["paid", "processing", "needs_review"] as const satisfies readonly OrderStatus[];

/** `payment_status` exactly as Stripe reports it on the Checkout Session. */
export const STRIPE_PAYMENT_STATUSES = ["unpaid", "paid", "no_payment_required"] as const;
export type StripePaymentStatus = (typeof STRIPE_PAYMENT_STATUSES)[number];

const inList = (values: readonly string[]) =>
  sql.raw(values.map((v) => `'${v}'`).join(", "));

/** Name and US address collected by Stripe Checkout. */
export type OrderShipping = {
  name: string;
  address: {
    line1: string | null;
    line2: string | null;
    city: string | null;
    state: string | null;
    postalCode: string | null;
    country: string | null;
  };
};

export const orders = pgTable(
  "orders",
  {
    /** Random UUID, so order URLs can't be guessed or counted. */
    id: text("id")
      .primaryKey()
      .default(sql`gen_random_uuid()::text`),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "restrict" }),
    status: text("status").$type<OrderStatus>().notNull().default("pending_payment"),
    currency: text("currency").notNull().default("usd"),
    subtotalCents: integer("subtotal_cents").notNull(),
    /** Equal to the subtotal until tax or shipping charges exist. */
    totalCents: integer("total_cents").notNull(),
    /** Customer email given to Stripe, then as confirmed by Stripe. */
    email: text("email").notNull(),
    shipping: jsonb("shipping").$type<OrderShipping>(),

    stripeCheckoutSessionId: text("stripe_checkout_session_id").unique(),
    stripePaymentIntentId: text("stripe_payment_intent_id").unique(),
    stripePaymentStatus: text("stripe_payment_status").$type<StripePaymentStatus>(),

    /** When the Checkout Session (and so the stock reservation) expires. */
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    paidAt: timestamp("paid_at", { withTimezone: true }),
    /** Set once reserved stock has been returned, so it's never returned twice. */
    stockReleasedAt: timestamp("stock_released_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [
    index("orders_user_id_created_at_idx").on(t.userId, t.createdAt.desc()),
    // Finds reservations to release when a session's expiry webhook never arrives.
    index("orders_pending_expires_at_idx")
      .on(t.expiresAt)
      .where(sql`${t.status} = 'pending_payment'`),
    check("orders_status_valid", sql`${t.status} IN (${inList(ORDER_STATUSES)})`),
    check(
      "orders_stripe_payment_status_valid",
      sql`${t.stripePaymentStatus} IS NULL OR ${t.stripePaymentStatus} IN (${inList(STRIPE_PAYMENT_STATUSES)})`,
    ),
    check("orders_currency_lowercase_iso", sql`${t.currency} ~ '^[a-z]{3}$'`),
    check("orders_amounts_non_negative", sql`${t.subtotalCents} >= 0 AND ${t.totalCents} >= 0`),
    check("orders_paid_has_paid_at", sql`${t.status} <> 'paid' OR ${t.paidAt} IS NOT NULL`),
  ],
);

export const orderItems = pgTable(
  "order_items",
  {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
    orderId: text("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    /** Null if the product is later deleted; the snapshot below keeps the history. */
    productId: integer("product_id").references(() => products.id, { onDelete: "set null" }),
    productSlug: text("product_slug").notNull(),
    productName: text("product_name").notNull(),
    sku: text("sku").notNull(),
    colour: text("colour").notNull(),
    /** Empty for one-size products. */
    size: text("size").notNull().default(""),
    imageUrl: text("image_url"),
    unitPriceCents: integer("unit_price_cents").notNull(),
    quantity: smallint("quantity").notNull(),
    lineTotalCents: integer("line_total_cents").notNull(),
    /**
     * Units taken from `products.stock_quantity` for this line. Equal to
     * `quantity`, or fewer for made-to-order pieces. Exactly this is returned
     * if the order doesn't complete.
     */
    reservedQuantity: smallint("reserved_quantity").notNull(),
  },
  (t) => [
    index("order_items_order_id_idx").on(t.orderId),
    index("order_items_product_id_idx").on(t.productId),
    check("order_items_quantity_range", sql`${t.quantity} BETWEEN 1 AND 10`),
    check(
      "order_items_reserved_range",
      sql`${t.reservedQuantity} BETWEEN 0 AND ${t.quantity}`,
    ),
    check("order_items_unit_price_non_negative", sql`${t.unitPriceCents} >= 0`),
    check(
      "order_items_line_total_matches",
      sql`${t.lineTotalCents} = ${t.unitPriceCents} * ${t.quantity}`,
    ),
  ],
);

/**
 * Every Stripe webhook event we've received, keyed by Stripe's event id.
 * A redelivered event finds its row already processed and is skipped.
 */
export const stripeEvents = pgTable("stripe_events", {
  id: text("id").primaryKey(),
  type: text("type").notNull(),
  /** Stripe's `created` time for the event. */
  stripeCreatedAt: timestamp("stripe_created_at", { withTimezone: true }).notNull(),
  receivedAt: timestamp("received_at", { withTimezone: true }).notNull().defaultNow(),
  /** Null until handled successfully; a failed attempt is retried by Stripe. */
  processedAt: timestamp("processed_at", { withTimezone: true }),
});

export const ordersRelations = relations(orders, ({ one, many }) => ({
  user: one(user, { fields: [orders.userId], references: [user.id] }),
  items: many(orderItems),
}));

export const orderItemsRelations = relations(orderItems, ({ one }) => ({
  order: one(orders, { fields: [orderItems.orderId], references: [orders.id] }),
  product: one(products, { fields: [orderItems.productId], references: [products.id] }),
}));
