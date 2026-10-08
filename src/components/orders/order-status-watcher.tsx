"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { clearBagForOrder } from "@/lib/checkout/actions";

const POLL_MS = 3000;
const GIVE_UP_MS = 60_000;

/**
 * Keeps the order page in step with our recorded order state. While payment
 * isn't confirmed it re-renders the page from the server every few seconds
 * (reading our database, not Stripe). Once confirmed, it empties the bag
 * that became this order.
 */
export function OrderStatusWatcher({
  orderId,
  awaitingConfirmation,
  clearBag,
  children,
}: {
  orderId: string;
  awaitingConfirmation: boolean;
  clearBag: boolean;
  children: ReactNode;
}) {
  const router = useRouter();
  const [slow, setSlow] = useState(false);

  useEffect(() => {
    if (!awaitingConfirmation) return;
    const started = Date.now();
    const timer = setInterval(() => {
      if (Date.now() - started > GIVE_UP_MS) {
        clearInterval(timer);
        setSlow(true);
        return;
      }
      router.refresh();
    }, POLL_MS);
    return () => clearInterval(timer);
  }, [awaitingConfirmation, router]);

  useEffect(() => {
    if (!clearBag) return;
    // Refresh so the header's bag count updates too.
    clearBagForOrder(orderId).then(() => router.refresh());
  }, [clearBag, orderId, router]);

  return (
    <div aria-live="polite" className="flex flex-col gap-2">
      {children}
      {awaitingConfirmation && slow && (
        <div className="flex flex-col gap-3 border-l-2 border-black pl-4 mt-2">
          <p className="text-sm">
            This is taking longer than usual. If you completed payment, you don’t need to do
            anything: this order updates as soon as Stripe confirms it, and you won’t be charged
            twice. If you didn’t finish paying, your bag is still there.
          </p>
          <div className="flex flex-wrap gap-3">
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => router.refresh()}>
              Check again
            </button>
            <Link href="/bag" className="btn btn-secondary btn-sm">
              Go to your bag
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
