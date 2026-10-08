"use client";

import { useEffect } from "react";
import { useFormStatus } from "react-dom";
import { startCheckout } from "@/lib/checkout/actions";
import { useCheckoutState } from "./checkout-state";

/**
 * The checkout action. It posts nothing: the server re-reads the bag, reserves
 * the stock and sends the customer to Stripe. Works without JavaScript.
 */
export function CheckoutForm({ disabled, compact = false }: { disabled: boolean; compact?: boolean }) {
  return (
    <form action={startCheckout} className={compact ? "shrink-0" : undefined}>
      <CheckoutButton disabled={disabled} compact={compact} />
    </form>
  );
}

function CheckoutButton({ disabled, compact }: { disabled: boolean; compact: boolean }) {
  const { pending } = useFormStatus();
  const { checkingOut, setCheckingOut } = useCheckoutState();
  // Share this form's progress with the rest of the bag (lines, other button).
  useEffect(() => {
    if (pending) setCheckingOut(true);
    return () => {
      if (pending) setCheckingOut(false);
    };
  }, [pending, setCheckingOut]);

  const busy = pending || checkingOut;
  return (
    <button
      type="submit"
      className={`btn btn-primary ${compact ? "" : "btn-lg btn-block"} ${busy ? "disabled:cursor-progress disabled:opacity-100" : ""}`}
      disabled={disabled || busy}
    >
      {busy && (
        <span
          aria-hidden="true"
          className="size-4 animate-spin rounded-full border-2 border-current border-r-transparent"
        />
      )}
      {busy ? (compact ? "Opening…" : "Opening secure checkout…") : "Check out"}
    </button>
  );
}

/** Spoken and shown while checkout opens. */
export function CheckoutProgress() {
  const { checkingOut } = useCheckoutState();
  return (
    <p role="status" className="text-sm empty:hidden">
      {checkingOut ? "Reserving your pieces and opening Stripe’s secure checkout…" : ""}
    </p>
  );
}
