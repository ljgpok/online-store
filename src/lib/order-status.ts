// Short order status labels for lists. Client-safe: no database access.
import type { OrderStatus } from "@/db/schema";

export const orderStatusLabel: Record<OrderStatus, { label: string; tone: string }> = {
  paid: { label: "Paid", tone: "text-confirm" },
  processing: { label: "Payment processing", tone: "text-black" },
  needs_review: { label: "Payment received, under review", tone: "text-black" },
  pending_payment: { label: "Awaiting payment", tone: "text-graphite" },
  payment_failed: { label: "Payment failed", tone: "text-alert" },
  expired: { label: "Checkout expired", tone: "text-graphite" },
  cancelled: { label: "Checkout replaced", tone: "text-graphite" },
};

/** Orders worth listing: placed, or being paid for. Abandoned checkouts never charged anything. */
export const LISTED_ORDER_STATUSES = [
  "paid",
  "processing",
  "needs_review",
  "pending_payment",
  "payment_failed",
] as const satisfies readonly OrderStatus[];
