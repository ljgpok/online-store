"use client";

import Link from "next/link";
import { startTransition, useActionState, useRef, useState, type FormEvent } from "react";
import { addToBag } from "@/lib/cart/actions";
import { isOrderable, stockCopy, stockState, stockTone } from "@/lib/stock";

type Props = {
  slug: string;
  /** Sizes to choose from; empty for one-size products. */
  sizes: string[];
  sizeGuide?: string;
  /** Units in stock for the whole product. */
  stock: number;
  /** When out of stock, the product can still be ordered and is made for the customer. */
  madeToOrder: boolean;
  stockDetail?: string;
};

export function PurchasePanel({
  slug,
  sizes,
  sizeGuide,
  stock,
  madeToOrder,
  stockDetail,
}: Props) {
  const [size, setSize] = useState<string | null>(null);
  const [error, setError] = useState(false);
  // The server checks size and stock again; its answer is shown below the button.
  const [result, formAction, pending] = useActionState(addToBag, null);
  const firstSize = useRef<HTMLInputElement>(null);

  const state = stockState(stock, madeToOrder);
  const soldOut = !isOrderable(state);
  const sized = sizes.length > 0;

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    // With JavaScript, submit here rather than through `action`: React resets a
    // form after an action submission, which would clear the chosen size.
    // `action` stays as the fallback before JavaScript loads.
    e.preventDefault();
    // Catch a missing size before the round trip; the action is still the judge.
    if (sized && !size) {
      setError(true);
      firstSize.current?.focus();
      return;
    }
    const formData = new FormData(e.currentTarget);
    startTransition(() => formAction(formData));
  }

  return (
    <form action={formAction} onSubmit={onSubmit} className="flex flex-col gap-6" noValidate>
      <input type="hidden" name="slug" value={slug} />
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
        <button
          type="submit"
          className={`btn btn-primary btn-lg btn-block ${pending ? "disabled:cursor-progress disabled:opacity-100" : ""}`}
          disabled={soldOut || pending}
        >
          {soldOut ? "Sold out" : pending ? "Adding…" : "Add to bag"}
        </button>
        {soldOut && (
          <p className="text-meta">
            This piece is sold out online. A client advisor can check store
            stock for you.
          </p>
        )}
        <p role="status" className="text-sm">
          {result?.ok && !pending && (
            <>
              Added to your bag: {result.message}.{" "}
              <Link href="/bag" className="link">
                View bag
              </Link>
            </>
          )}
        </p>
        <p role="alert" className="text-sm text-alert empty:hidden">
          {result && !result.ok && !pending ? result.error : null}
        </p>
      </div>
    </form>
  );
}
