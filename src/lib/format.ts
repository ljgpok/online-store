const usd = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

/** Formats whole dollars, e.g. 4200 → "$4,200". */
export function formatPrice(amount: number) {
  return usd.format(amount);
}
