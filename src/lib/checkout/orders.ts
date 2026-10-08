// Every order status change happens here, so the webhook, the return page and
// checkout itself all follow the same rules. Each change is a conditional
// UPDATE that only matches the states it may move from, which makes repeated
// or late Stripe events harmless.
import "server-only";
import { and, eq, inArray, isNull, lt, or, sql } from "drizzle-orm";
import type Stripe from "stripe";
import { db } from "@/db";
import {
  orders,
  STRIPE_PAYMENT_STATUSES,
  type OrderShipping,
  type OrderStatus,
  type StripePaymentStatus,
} from "@/db/schema";
import { stripe } from "@/lib/stripe";

/**
 * Stripe's `payment_status`, or null for a value Stripe adds later that our
 * CHECK constraint doesn't know (which would otherwise fail every retry).
 */
export function toPaymentStatus(value: string | null | undefined): StripePaymentStatus | null {
  return STRIPE_PAYMENT_STATUSES.find((s) => s === value) ?? null;
}

type ReleaseStatus = Extract<OrderStatus, "expired" | "payment_failed" | "cancelled">;

/**
 * Moves an order to a closed status and returns its reserved stock, in one
 * statement. Only the caller that wins the status change returns stock, and
 * `stock_released_at` guards against ever returning it twice.
 */
export async function releaseOrder(
  orderId: string,
  to: ReleaseStatus,
  from: OrderStatus[],
  stripePaymentStatus?: StripePaymentStatus | null,
): Promise<boolean> {
  const fromList = sql.join(
    from.map((s) => sql`${s}`),
    sql`, `,
  );
  const result = await db.execute(sql`
    WITH released AS (
      UPDATE orders
      SET status = ${to},
          stock_released_at = now(),
          updated_at = now(),
          stripe_payment_status = COALESCE(${stripePaymentStatus ?? null}, stripe_payment_status)
      WHERE id = ${orderId} AND status IN (${fromList}) AND stock_released_at IS NULL
      RETURNING id
    ), returned AS (
      UPDATE products p
      SET stock_quantity = p.stock_quantity + r.qty
      FROM (
        SELECT i.product_id, sum(i.reserved_quantity)::int AS qty
        FROM order_items i JOIN released ON i.order_id = released.id
        WHERE i.product_id IS NOT NULL
        GROUP BY i.product_id
      ) r
      WHERE p.id = r.product_id
      RETURNING p.id
    )
    SELECT (SELECT count(*) FROM released)::int AS released`);
  return (result.rows[0] as { released: number }).released === 1;
}

function shippingFrom(session: Stripe.Checkout.Session): OrderShipping | undefined {
  const details = session.collected_information?.shipping_details;
  if (!details) return undefined;
  const a = details.address;
  return {
    name: details.name,
    address: {
      line1: a.line1,
      line2: a.line2,
      city: a.city,
      state: a.state,
      postalCode: a.postal_code,
      country: a.country,
    },
  };
}

const idOf = (value: string | { id: string } | null) =>
  value === null ? null : typeof value === "string" ? value : value.id;

/**
 * Brings our order in line with a Checkout Session that came either from a
 * verified webhook or from Stripe's API. Never from the browser.
 */
export async function applySession(session: Stripe.Checkout.Session): Promise<void> {
  const order = await db.query.orders.findFirst({
    where: eq(orders.stripeCheckoutSessionId, session.id),
  });
  if (!order) {
    console.warn(`[checkout] No order for Checkout Session ${session.id}`);
    return;
  }
  const paymentStatus = toPaymentStatus(session.payment_status);

  if (session.status === "expired") {
    await releaseOrder(order.id, "expired", ["pending_payment"], paymentStatus);
    return;
  }
  if (session.status !== "complete") return; // Still open: nothing has happened yet.

  const details = {
    stripePaymentStatus: paymentStatus,
    stripePaymentIntentId: idOf(session.payment_intent),
    email: session.customer_details?.email ?? order.email,
    shipping: shippingFrom(session) ?? order.shipping,
    updatedAt: new Date(),
  };

  if (paymentStatus !== "paid" && paymentStatus !== "no_payment_required") {
    // A delayed payment method: accepted, but funds aren't confirmed yet.
    await db
      .update(orders)
      .set({ ...details, status: "processing" })
      .where(and(eq(orders.id, order.id), eq(orders.status, "pending_payment")));
    return;
  }

  // Paid. Only trust it if it's this order, for exactly this amount.
  const matches =
    session.metadata?.order_id === order.id &&
    session.amount_total === order.totalCents &&
    session.currency === order.currency;
  if (!matches) {
    console.error(
      `[checkout] Order ${order.id} paid with a mismatch: metadata ${session.metadata?.order_id}, ` +
        `amount ${session.amount_total} ${session.currency} vs ${order.totalCents} ${order.currency}`,
    );
  }
  await db
    .update(orders)
    .set({
      ...details,
      status: matches ? "paid" : "needs_review",
      paidAt: new Date(),
    })
    .where(and(eq(orders.id, order.id), inArray(orders.status, ["pending_payment", "processing"])));
}

/** Handles the Checkout events we subscribe to. Others are ignored. */
export async function applyEvent(event: Stripe.Event): Promise<void> {
  switch (event.type) {
    case "checkout.session.completed":
    case "checkout.session.async_payment_succeeded":
    case "checkout.session.expired":
      await applySession(event.data.object);
      return;
    case "checkout.session.async_payment_failed": {
      const order = await db.query.orders.findFirst({
        columns: { id: true },
        where: eq(orders.stripeCheckoutSessionId, event.data.object.id),
      });
      if (order) {
        await releaseOrder(order.id, "payment_failed", ["processing", "pending_payment"], "unpaid");
      }
      return;
    }
  }
}

/** Re-reads a session from Stripe and applies it. */
export async function syncSession(sessionId: string): Promise<void> {
  await applySession(await stripe().checkout.sessions.retrieve(sessionId));
}

/**
 * Closes a pending order before its stock is reused: expires its open session
 * at Stripe, then releases it. If Stripe says it was actually paid or expired,
 * that's applied instead, so a paid order is never released by mistake.
 */
async function closePendingOrder(order: { id: string; stripeCheckoutSessionId: string | null }) {
  if (!order.stripeCheckoutSessionId) {
    await releaseOrder(order.id, "cancelled", ["pending_payment"]);
    return;
  }
  const session = await stripe().checkout.sessions.retrieve(order.stripeCheckoutSessionId);
  if (session.status === "open") {
    await stripe().checkout.sessions.expire(session.id);
    await releaseOrder(order.id, "cancelled", ["pending_payment"]);
  } else {
    await applySession(session);
  }
}

/** A customer starting a new checkout replaces any they left unfinished. */
export async function closeOpenOrdersFor(userId: string) {
  const open = await db.query.orders.findMany({
    columns: { id: true, stripeCheckoutSessionId: true },
    where: and(eq(orders.userId, userId), eq(orders.status, "pending_payment")),
  });
  for (const order of open) await closePendingOrder(order);
}

/**
 * Safety net for missed webhooks: settles a few pending orders whose session
 * should have expired more than five minutes ago, by asking Stripe.
 */
export async function settleOverdueOrders(limit = 5) {
  const overdue = await db.query.orders.findMany({
    columns: { id: true, stripeCheckoutSessionId: true },
    where: and(
      eq(orders.status, "pending_payment"),
      or(
        lt(orders.expiresAt, new Date(Date.now() - 5 * 60_000)),
        // Session creation never finished, so there's no expiry to wait for.
        and(isNull(orders.expiresAt), lt(orders.createdAt, new Date(Date.now() - 35 * 60_000))),
      ),
    ),
    limit,
  });
  for (const order of overdue) {
    try {
      if (order.stripeCheckoutSessionId) await syncSession(order.stripeCheckoutSessionId);
      else await releaseOrder(order.id, "cancelled", ["pending_payment"]);
    } catch (error) {
      console.error(`[checkout] Couldn't settle overdue order ${order.id}`, error);
    }
  }
}
