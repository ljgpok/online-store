import { formatPrice } from "@/lib/format";

// Shared by product cards and the product page so sale prices read the same everywhere.
export function Price({ price, salePrice }: { price: number; salePrice?: number }) {
  if (!salePrice) {
    return <span className="product-card__price">{formatPrice(price)}</span>;
  }
  return (
    <span>
      <s className="product-card__price">
        <span className="visually-hidden">Was </span>
        {formatPrice(price)}
      </s>{" "}
      <span className="product-card__price--sale">
        <span className="visually-hidden">now </span>
        {formatPrice(salePrice)}
      </span>
    </span>
  );
}
