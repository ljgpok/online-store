// Storefront product types. Safe to import from client components:
// nothing here touches the database.

export type Photo = {
  src: string;
  alt: string;
};

export type Category = {
  name: string;
  href: string;
};

/** A category tile on the homepage, with how many products it holds. */
export type CategorySummary = Category & {
  slug: string;
  image?: Photo;
  productCount: number;
};

export type Product = {
  slug: string;
  sku: string;
  name: string;
  colour: string;
  category: Category;
  /** Whole dollars; the database stores cents. */
  price: number;
  salePrice?: number;
  /** In display order; the first is the product card image. May be empty. */
  images: Photo[];
  description: string;
  details: string[];
  /** Sizes offered, in display order. Empty for one-size products. */
  sizes: string[];
  sizeGuide?: string;
  /** Units in stock for the whole product, across all sizes. */
  stock: number;
  /** When out of stock, the product can still be ordered and is made for the customer. */
  madeToOrder: boolean;
  /** Availability note, such as the lead time for made-to-order pieces. */
  stockDetail?: string;
};
