import Image from "next/image";
import Link from "next/link";
import type { Product } from "@/lib/products";
import { stockCopy, stockState, stockTone } from "@/lib/stock";
import { Price } from "./price";

export function ProductCard({ product }: { product: Product }) {
  const { slug, name, colour, price, salePrice, images, stock, madeToOrder } = product;
  const state = stockState(stock, madeToOrder);
  const badge =
    state === "sold-out"
      ? "Sold out"
      : state === "made-to-order"
        ? "Made to order"
        : salePrice
          ? "Sale"
          : null;
  const image = images[0];

  return (
    <Link href={`/products/${slug}`} className="product-card">
      <div className="media-product">
        {image && (
          <Image
            src={image.src}
            alt={image.alt}
            fill
            sizes="(width >= 80rem) 25vw, (width >= 48rem) 33vw, 50vw"
          />
        )}
        {badge && <span className="badge absolute top-3 left-3">{badge}</span>}
      </div>
      <div className="product-card__info">
        <span>{name}</span>
        <span className="text-meta">{colour}</span>
        <Price price={price} salePrice={salePrice} />
        {/* Sold out and made to order have badges; low stock is worth saying here. */}
        {state === "low-stock" && (
          <span className={`text-sm ${stockTone(state)}`}>{stockCopy(state, stock)}</span>
        )}
      </div>
    </Link>
  );
}
