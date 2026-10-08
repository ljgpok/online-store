import "server-only";
import { and, asc, count, desc, eq, inArray } from "drizzle-orm";
import { cache } from "react";
import type { CartLine, CartView } from "@/lib/cart/types";
import { LISTED_ORDER_STATUSES } from "@/lib/order-status";
import type { CategorySummary, Product } from "@/lib/products";
import { db } from "./index";
import {
  categories,
  orders,
  productImages,
  products,
  type OrderShipping,
  type OrderStatus,
} from "./schema";

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

/** What the bag needs about a product: prices in cents and current stock. */
export type CartProduct = {
  id: number;
  slug: string;
  sku: string;
  name: string;
  colour: string;
  sizes: string[];
  priceCents: number;
  salePriceCents: number | null;
  stockQuantity: number;
  madeToOrder: boolean;
  stockDetail: string | null;
  image?: { url: string; alt: string };
};

const cartColumns = {
  id: true,
  slug: true,
  sku: true,
  name: true,
  colour: true,
  sizes: true,
  priceCents: true,
  salePriceCents: true,
  stockQuantity: true,
  madeToOrder: true,
  stockDetail: true,
} as const;


type CartProductRow = Omit<CartProduct, "image"> & { images: { url: string; alt: string }[] };

const toCartProduct = ({ images, ...row }: CartProductRow): CartProduct => ({
  ...row,
  image: images[0],
});

/** Fresh, uncached: the bag must see the latest price and stock. */
export async function getCartProducts(ids: number[]): Promise<CartProduct[]> {
  if (ids.length === 0) return [];
  const rows = await db.query.products.findMany({
    columns: cartColumns,
    with: {
      images: { columns: { url: true, alt: true }, orderBy: [asc(productImages.position)], limit: 1 },
    },
    where: inArray(products.id, ids),
  });
  return rows.map(toCartProduct);
}

export async function getCartProductBySlug(slug: string): Promise<CartProduct | undefined> {
  const row = await db.query.products.findFirst({
    columns: cartColumns,
    with: {
      images: { columns: { url: true, alt: true }, orderBy: [asc(productImages.position)], limit: 1 },
    },
    where: eq(products.slug, slug),
  });
  return row ? toCartProduct(row) : undefined;
}

/** A priced bag line in cents, before `mapCart`. */
export type CartLineCents = Omit<
  CartLine,
  "price" | "salePrice" | "lineTotal" | "image" | "stockDetail"
> & {
  stockDetail: string | null;
  priceCents: number;
  salePriceCents: number | null;
  lineTotalCents: number;
  image?: { url: string; alt: string };
};

/** Bag totals are added up in cents; this is the only place they become dollars. */
export function mapCart(lines: CartLineCents[], subtotalCents: number): CartView {
  return {
    lines: lines.map(({ priceCents, salePriceCents, lineTotalCents, image, stockDetail, ...line }) => ({
      ...line,
      stockDetail: stockDetail ?? undefined,
      price: priceCents / 100,
      salePrice: salePriceCents === null ? undefined : salePriceCents / 100,
      lineTotal: lineTotalCents / 100,
      image: image ? { src: image.url, alt: image.alt } : undefined,
    })),
    itemCount: lines.reduce((sum, l) => sum + l.quantity, 0),
    subtotal: subtotalCents / 100,
    hasIssues: lines.some((l) => l.issue),
  };
}

/** An order as the confirmation page shows it, in whole dollars. */
export type OrderView = {
  id: string;
  status: OrderStatus;
  createdAt: Date;
  paidAt?: Date;
  email: string;
  shipping?: OrderShipping;
  subtotal: number;
  total: number;
  items: {
    slug: string;
    /** False if the product has since been deleted; the snapshot remains. */
    productAvailable: boolean;
    name: string;
    colour: string;
    size: string;
    image?: string;
    unitPrice: number;
    quantity: number;
    lineTotal: number;
  }[];
};

const ORDER_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

/**
 * The customer's own order, or undefined. The query is scoped to `userId`, so
 * another customer's order id finds nothing, exactly like one that doesn't exist.
 * Cached per request so the page and its metadata share one query.
 */
export const getOrderForUser = cache(async (id: string, userId: string): Promise<OrderView | undefined> => {
  if (!ORDER_ID.test(id)) return undefined;
  const row = await db.query.orders.findFirst({
    where: and(eq(orders.id, id), eq(orders.userId, userId)),
    with: { items: { orderBy: (i, { asc }) => [asc(i.id)] } },
  });
  if (!row) return undefined;
  return {
    id: row.id,
    status: row.status,
    createdAt: row.createdAt,
    paidAt: row.paidAt ?? undefined,
    email: row.email,
    shipping: row.shipping ?? undefined,
    subtotal: row.subtotalCents / 100,
    total: row.totalCents / 100,
    items: row.items.map((i) => ({
      slug: i.productSlug,
      productAvailable: i.productId !== null,
      name: i.productName,
      colour: i.colour,
      size: i.size,
      image: i.imageUrl ?? undefined,
      unitPrice: i.unitPriceCents / 100,
      quantity: i.quantity,
      lineTotal: i.lineTotalCents / 100,
    })),
  };
});

/** The customer's checkout still awaiting payment, if any. */
export async function getPendingOrderForUser(userId: string) {
  return db.query.orders.findFirst({
    columns: { id: true, stripeCheckoutSessionId: true, expiresAt: true },
    where: and(eq(orders.userId, userId), eq(orders.status, "pending_payment")),
    orderBy: desc(orders.createdAt),
  });
}

/** One row of the customer's order history, in whole dollars. */
export type OrderSummary = {
  id: string;
  status: OrderStatus;
  /** When it was paid, or when checkout started if it hasn't been. */
  date: Date;
  total: number;
  itemCount: number;
  /** Distinct lines (product and size). */
  lineCount: number;
  firstItemName: string;
  /** Up to three product images, in order. */
  images: string[];
};

/** The signed-in customer's orders, newest first. Never anyone else's. */
export async function getOrdersForUser(userId: string, limit = 50): Promise<OrderSummary[]> {
  const rows = await db.query.orders.findMany({
    columns: { id: true, status: true, createdAt: true, paidAt: true, totalCents: true },
    where: and(eq(orders.userId, userId), inArray(orders.status, [...LISTED_ORDER_STATUSES])),
    with: {
      items: {
        columns: { productName: true, quantity: true, imageUrl: true },
        orderBy: (i, { asc }) => [asc(i.id)],
      },
    },
    orderBy: desc(orders.createdAt),
    limit,
  });
  return rows.map((row) => ({
    id: row.id,
    status: row.status,
    date: row.paidAt ?? row.createdAt,
    total: row.totalCents / 100,
    itemCount: row.items.reduce((sum, i) => sum + i.quantity, 0),
    lineCount: row.items.length,
    firstItemName: row.items[0]?.productName ?? "",
    images: row.items.flatMap((i) => (i.imageUrl ? [i.imageUrl] : [])).slice(0, 3),
  }));
}
