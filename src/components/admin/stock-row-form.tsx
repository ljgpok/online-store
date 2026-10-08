"use client";

import { startTransition, useActionState, useState, type FormEvent } from "react";
import { updateStock } from "@/lib/admin/actions/stock";

type Mode = "adjust" | "set";

/**
 * Adjust by a relative amount (safe while customers buy), or set an exact
 * count, which only applies if stock still equals `available` as shown.
 * The server re-checks everything; this form only collects the request.
 */
export function StockRowForm({
  productId,
  productName,
  available,
  idPrefix = "stock",
}: {
  productId: number;
  productName: string;
  available: number;
  /** Keeps ids unique when the same product renders as a table row and a card. */
  idPrefix?: string;
}) {
  const [state, action, pending] = useActionState(updateStock, null);
  const [mode, setMode] = useState<Mode>("adjust");
  const amountId = `${idPrefix}-amount-${productId}`;
  const errorId = `${idPrefix}-error-${productId}`;
  const error = state && !state.ok ? (state.errors.amount ?? state.errors.form) : undefined;

  // Submit here rather than through `action` when JavaScript runs: React resets
  // a form after an action submission, which would flip the mode radios back to
  // "Adjust by" while the label still says "Set to". A retry would then send
  // the wrong mode. `action` remains the fallback without JavaScript.
  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    startTransition(() => action(formData));
  }

  return (
    <form action={action} onSubmit={onSubmit} className="flex flex-col gap-2 md:min-w-72">
      <input type="hidden" name="productId" value={productId} />
      <input type="hidden" name="expected" value={available} />
      <div className="flex flex-wrap items-center gap-2">
        <fieldset className="flex gap-1">
          <legend className="visually-hidden">How to change stock for {productName}</legend>
          {(["adjust", "set"] as const).map((m) => (
            <label
              key={m}
              className="chip min-h-9 cursor-pointer px-3 has-checked:border-black has-checked:bg-black has-checked:text-white has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-lapis"
            >
              <input
                type="radio"
                name="mode"
                value={m}
                checked={mode === m}
                onChange={() => setMode(m)}
                className="visually-hidden"
              />
              {m === "adjust" ? "Adjust by" : "Set to"}
            </label>
          ))}
        </fieldset>
        <label htmlFor={amountId} className="visually-hidden">
          {mode === "adjust" ? `Change in stock for ${productName}` : `New stock for ${productName}`}
        </label>
        <input
          id={amountId}
          name="amount"
          inputMode={mode === "adjust" ? "text" : "numeric"}
          autoComplete="off"
          placeholder={mode === "adjust" ? "+5 or −2" : String(available)}
          className="input min-h-9 w-24"
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : undefined}
          required
        />
        <button
          type="submit"
          className={`btn btn-secondary btn-sm ${pending ? "disabled:cursor-progress disabled:opacity-100" : ""}`}
          disabled={pending}
        >
          {pending ? "Saving…" : "Save"}
        </button>
      </div>
      <p id={errorId} role="alert" className="text-sm text-alert empty:hidden">
        {!pending && error}
      </p>
      <p role="status" className="text-sm text-confirm empty:hidden">
        {!pending && state?.ok ? state.message : null}
      </p>
    </form>
  );
}
