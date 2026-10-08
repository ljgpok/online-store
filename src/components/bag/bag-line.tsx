"use client";

import Image from "next/image";
import Link from "next/link";
import { useActionState } from "react";
import { Price } from "@/components/price";
import { removeLine, updateQuantity } from "@/lib/cart/actions";
import type { CartLine } from "@/lib/cart/types";
import { useCheckoutState } from "./checkout-state";
import { formatPrice } from "@/lib/format";
import { MAX_LINE_QUANTITY, stockCopy, stockTone } from "@/lib/stock";

// One bag line. The −/+ buttons and Remove are plain forms posting to server
// actions, so they work before JavaScript loads; the server re-checks stock.
export function BagLine({ line }: { line: CartLine }) {
  const [updateResult, update, updating] = useActionState(updateQuantity, null);
  const [, remove, removing] = useActionState(removeLine, null);
  const { checkingOut } = useCheckoutState();
  // Locked while checkout opens, as well as during this line's own changes.
  const busy = updating || removing || checkingOut;
  const href = `/products/${line.slug}`;
  const soldOut = line.issue === "sold-out";
  const label = line.size ? `${line.name}, size ${line.size}` : line.name;
  const error = updateResult && !updateResult.ok && !updating ? updateResult.error : null;

  return (
    <li
      className={`grid grid-cols-[5.5rem_minmax(0,1fr)] gap-x-4 gap-y-3 py-6 transition-opacity sm:grid-cols-[8rem_minmax(0,1fr)] sm:gap-x-6 ${busy ? "opacity-60" : ""}`}
      aria-busy={updating || removing}
    >
      <Link
        href={href}
        className={`media-product ${soldOut ? "opacity-50" : ""}`}
        tabIndex={-1}
        aria-hidden="true"
      >
        {line.image && <Image src={line.image.src} alt="" fill sizes="8rem" />}
      </Link>

      <div className="flex min-w-0 flex-col gap-3">
        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
          <div className="flex min-w-0 flex-col gap-1">
            <Link href={href} className="text-ui font-medium hover:text-lapis">
              {line.name}
            </Link>
            <span className="text-meta">
              {line.colour}
              {line.size && <> · Size {line.size}</>}
            </span>
            <span className="text-sm">
              <Price price={line.price} salePrice={line.salePrice} />
            </span>
          </div>
          <p className={`text-ui ${soldOut ? "text-graphite line-through" : ""}`}>
            <span className="visually-hidden">
              {soldOut ? "Not included in subtotal: " : "Line total "}
            </span>
            {formatPrice(line.lineTotal)}
          </p>
        </div>

        <Availability line={line} />

        {soldOut ? (
          <p className="text-meta">Quantity {line.quantity}</p>
        ) : (
          <form action={update} className="flex flex-wrap items-center gap-x-4 gap-y-2">
            <input type="hidden" name="productId" value={line.productId} />
            <input type="hidden" name="size" value={line.size} />
            <QuantityStepper
              label={label}
              quantity={line.quantity}
              max={line.maxQuantity}
              disabled={busy}
            />
            {/* One click back within stock. Posts the same form with a fixed quantity. */}
            {line.issue === "reduced" && line.maxQuantity > 0 && (
              <button
                type="submit"
                name="quantity"
                value={line.maxQuantity}
                className="btn btn-secondary btn-sm"
                disabled={busy}
              >
                Change to {line.maxQuantity}
              </button>
            )}
          </form>
        )}

        <p role="alert" className="text-sm text-alert empty:hidden">
          {error}
        </p>

        <form
          action={remove}
          // The line disappears once removed, so keep keyboard focus on the page.
          onSubmit={() => document.getElementById("bag-heading")?.focus()}
        >
          <input type="hidden" name="productId" value={line.productId} />
          <input type="hidden" name="size" value={line.size} />
          <button
            type="submit"
            className="link-quiet text-sm underline underline-offset-4 disabled:cursor-progress"
            disabled={busy}
          >
            {removing ? "Removing…" : "Remove"}
            <span className="visually-hidden"> {label}</span>
          </button>
        </form>
      </div>
    </li>
  );
}

/**
 * The stock note under a line: problems first, then the same wording the
 * product page uses (`stockCopy`), then why "+" has stopped.
 */
function Availability({ line }: { line: CartLine }) {
  const acrossSizes = line.size ? " across all sizes" : "";

  if (line.issue === "sold-out") {
    return (
      <p className="text-sm text-alert">
        Sold out. This piece is no longer available, so it isn’t included in your subtotal.
      </p>
    );
  }
  if (line.issue === "reduced") {
    return (
      <p className="text-sm text-alert">
        {line.maxQuantity > 0
          ? `Only ${line.available} available${acrossSizes}. Lower the quantity to continue.`
          : `Only ${line.available} available${acrossSizes}, already in your bag in another size. Remove this one to continue.`}
      </p>
    );
  }

  const atMax = line.quantity >= line.maxQuantity;
  const limitNote = atMax
    ? line.available === MAX_LINE_QUANTITY
      ? `Limit of ${MAX_LINE_QUANTITY} per piece.`
      : `That’s all we have${acrossSizes}.`
    : null;
  const showState = line.stockState === "low-stock" || line.stockState === "made-to-order";

  if (!showState && !limitNote) return null;
  return (
    <div className="flex flex-col gap-1 text-sm">
      {showState && (
        <p className={stockTone(line.stockState)}>
          {stockCopy(line.stockState, line.stockUnits)}
          {limitNote && <span className="text-graphite"> · {limitNote}</span>}
        </p>
      )}
      {!showState && limitNote && <p className="text-graphite">{limitNote}</p>}
      {line.stockState === "made-to-order" && line.stockDetail && (
        <p className="text-meta">{line.stockDetail}</p>
      )}
    </div>
  );
}

function QuantityStepper({
  label,
  quantity,
  max,
  disabled,
}: {
  label: string;
  quantity: number;
  max: number;
  disabled: boolean;
}) {
  const atMax = quantity >= max;
  return (
    <div
      role="group"
      aria-label={`Quantity for ${label}`}
      className="inline-flex items-center border border-rule"
    >
      <button
        type="submit"
        name="quantity"
        value={quantity - 1}
        className="btn-icon disabled:cursor-not-allowed disabled:text-graphite"
        disabled={disabled}
        aria-label={quantity === 1 ? `Remove ${label}` : `Decrease quantity of ${label}`}
      >
        <span aria-hidden="true">−</span>
      </button>
      <output className="min-w-8 text-center text-ui" aria-live="polite">
        <span className="visually-hidden">Quantity </span>
        {quantity}
      </output>
      <button
        type="submit"
        name="quantity"
        value={quantity + 1}
        className="btn-icon disabled:cursor-not-allowed disabled:text-rule"
        disabled={disabled || atMax}
        aria-label={`Increase quantity of ${label}`}
      >
        <span aria-hidden="true">+</span>
      </button>
    </div>
  );
}
