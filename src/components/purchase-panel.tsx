"use client";

import Link from "next/link";
import { useRef, useState, type FormEvent } from "react";
import { isOrderable, stockCopy, stockState, stockTone } from "@/lib/stock";

type Props = {
  name: string;
  /** Sizes to choose from; empty for one-size products. */
  sizes: string[];
  sizeGuide?: string;
  /** Units in stock for the whole product. */
  stock: number;
  /** When out of stock, the product can still be ordered and is made for the customer. */
  madeToOrder: boolean;
  stockDetail?: string;
};

export function PurchasePanel({ name, sizes, sizeGuide, stock, madeToOrder, stockDetail }: Props) {
  const [size, setSize] = useState<string | null>(null);
  const [error, setError] = useState(false);
  const [added, setAdded] = useState<string | null>(null);
  const firstSize = useRef<HTMLInputElement>(null);

  const state = stockState(stock, madeToOrder);
  const soldOut = !isOrderable(state);
  const sized = sizes.length > 0;

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (sized && !size) {
      setError(true);
      firstSize.current?.focus();
      return;
    }
    // No bag service yet: confirm the choice so the flow can be reviewed end to end.
    setAdded(size ? `${name}, size ${size}` : name);
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-6" noValidate>
      {sized && (
        <fieldset aria-describedby={error ? "size-error" : undefined} disabled={soldOut}>
          <legend className="label">
            Size{size && <span className="font-normal text-graphite">: {size}</span>}
          </legend>
          <div className="flex flex-wrap gap-2">
            {sizes.map((label, i) => (
              <label
                key={label}
                className="chip min-w-12 justify-center has-checked:border-black has-checked:bg-black has-checked:text-white has-disabled:cursor-not-allowed has-disabled:border-rule has-disabled:text-graphite has-disabled:line-through has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-lapis"
              >
                <input
                  ref={i === 0 ? firstSize : undefined}
                  type="radio"
                  name="size"
                  value={label}
                  checked={size === label}
                  onChange={() => {
                    setSize(label);
                    setError(false);
                    setAdded(null);
                  }}
                  className="visually-hidden"
                />
                {label}
              </label>
            ))}
          </div>
          {error && (
            <p id="size-error" className="mt-3 text-sm text-alert">
              Select a size to add this to your bag.
            </p>
          )}
          {sizeGuide && <p className="text-meta mt-3">{sizeGuide}</p>}
        </fieldset>
      )}

      {/* When nothing is left, the disabled button already says so. */}
      {!soldOut && (
        <div className="flex flex-col gap-1">
          <p className={`text-sm ${stockTone(state)}`}>{stockCopy(state, stock)}</p>
          {state === "made-to-order" && stockDetail && <p className="text-meta">{stockDetail}</p>}
        </div>
      )}

      <div className="flex flex-col gap-3">
        <button type="submit" className="btn btn-primary btn-lg btn-block" disabled={soldOut}>
          {soldOut ? "Sold out" : "Add to bag"}
        </button>
        {soldOut && (
          <p className="text-meta">
            This piece is sold out online. A client advisor can check store
            stock for you.
          </p>
        )}
        <p role="status" className="text-sm">
          {added && (
            <>
              Added to your bag: {added}.{" "}
              <Link href="/bag" className="link">
                View bag
              </Link>
            </>
          )}
        </p>
      </div>
    </form>
  );
}
