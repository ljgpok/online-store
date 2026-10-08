"use server";

// Starts Stripe Checkout for the signed-in customer's bag. The form posts no
// data: everything comes from the session, the bag cookie (ids, sizes and
// quantities only) and fresh product rows.
import { and, eq, inArray } from "drizzle-orm";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { getCartProducts } from "@/db/queries";
import { CONFIRMED_STATUSES, orders } from "@/db/schema";
import { requireUser } from "@/lib/auth/session";
import { readCartLines, readCartOrderId, writeCartLines } from "@/lib/cart/cookie";
import { buildCart } from "@/lib/cart/server";
import { stripe } from "@/lib/stripe";
import { closeOpenOrdersFor, releaseOrder, settleOverdueOrders, toPaymentStatus } from "./orders";
import { reserveOrder } from "./reserve";

/** Stripe's minimum is 30 minutes; a little extra covers clock skew. */
const SESSION_MINUTES = 31;
/** Labels these sessions in the Stripe Dashboard. */
const INTEGRATION_IDENTIFIER = "claude-shop-bag-checkout-qvkmhtrz";

function siteUrl() {
  // The site's own base URL (the same one Better Auth uses), never a request
  // header, so Stripe can only send customers back here.
  const url = process.env.BETTER_AUTH_URL;
  if (!url) throw new Error("BETTER_AUTH_URL is not set");
  return url.replace(/\/$/, "");
}

export async function startCheckout() {
  const { user } = await requireUser("/bag");

  // 1. Re-validate the bag against current products and stock.
  const stored = await readCartLines();
  // Counting this customer's own held units: step 2 releases them before reserving.
  const products = await getCartProducts([...new Set(stored.map((l) => l.productId))], user.id);
  const cart = buildCart(stored, products);
  if (cart.lines.length === 0) redirect("/bag");
  if (cart.hasIssues) redirect("/bag?checkout=unavailable");

  // 2. Replace this customer's unfinished checkout, and settle any overdue ones.
  try {
    await closeOpenOrdersFor(user.id);
  } catch (error) {
    console.error("[checkout] Couldn't close previous checkout", error);
    redirect("/bag?checkout=error");
  }
  await settleOverdueOrders();

  // 3. Create the order and take the stock, all or nothing.
  const lines = cart.lines.map((l) => ({ productId: l.productId, size: l.size, quantity: l.quantity }));
  const result = await reserveOrder(user, lines, new Map(products.map((p) => [p.id, p])));
  if (!result.ok) redirect("/bag?checkout=stock");
  const { orderId, items } = result.reservation;

  // 4. Open a Stripe Checkout Session priced from the order rows just written.
  let sessionUrl: string | undefined;
  try {
    const base = siteUrl();
    const session = await stripe().checkout.sessions.create(
      {
        mode: "payment",
        line_items: items.map((item) => ({
          quantity: item.quantity,
          price_data: {
            currency: "usd",
            unit_amount: item.unitPriceCents,
            product_data: {
              name: item.size ? `${item.productName}, size ${item.size}` : item.productName,
              description: item.colour,
              images: item.imageUrl ? [item.imageUrl] : undefined,
              metadata: { sku: item.sku },
            },
          },
        })),
        customer_email: user.email,
        client_reference_id: orderId,
        metadata: { order_id: orderId },
        payment_intent_data: { metadata: { order_id: orderId } },
        shipping_address_collection: { allowed_countries: ["US"] },
        expires_at: Math.floor(Date.now() / 1000) + SESSION_MINUTES * 60,
        success_url: `${base}/checkout/return?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${base}/bag?checkout=cancelled`,
        integration_identifier: INTEGRATION_IDENTIFIER,
      },
      // A retried request for this order can never open a second session.
      { idempotencyKey: `checkout-session-${orderId}` },
    );
    if (!session.url) throw new Error(`Checkout Session ${session.id} has no URL`);
    // Attach only while the order is still pending. A newer checkout from this
    // customer may have replaced it (and returned its stock) while Stripe was
    // creating the session; then the session must never be paid.
    const attached = await db
      .update(orders)
      .set({
        stripeCheckoutSessionId: session.id,
        stripePaymentStatus: toPaymentStatus(session.payment_status),
        expiresAt: new Date(session.expires_at * 1000),
      })
      .where(and(eq(orders.id, orderId), eq(orders.status, "pending_payment")))
      .returning({ id: orders.id });
    if (attached.length > 0) {
      sessionUrl = session.url;
    } else {
      await stripe()
        .checkout.sessions.expire(session.id)
        .catch((error) => console.error(`[checkout] Couldn't expire orphaned session ${session.id}`, error));
    }
  } catch (error) {
    console.error(`[checkout] Couldn't start Stripe Checkout for order ${orderId}`, error);
    await releaseOrder(orderId, "cancelled", ["pending_payment"]);
    redirect("/bag?checkout=error");
  }
  // Its URL was never shown, so expiring it above means it can't be paid.
  if (!sessionUrl) redirect("/bag?checkout=replaced");

  // Remember which order this bag became, so confirming it can clear the bag.
  await writeCartLines(stored, orderId);
  redirect(sessionUrl);
}

/**
 * Empties the bag once the order it became is confirmed. Called by the order
 * page, which may see the confirmation after the return page did. Only clears
 * the exact bag that was checked out, and only for the customer's own order.
 */
export async function clearBagForOrder(orderId: string) {
  const { user } = await requireUser("/bag");
  if ((await readCartOrderId()) !== orderId) return;
  const order = await db.query.orders.findFirst({
    columns: { id: true },
    where: and(eq(orders.id, orderId), eq(orders.userId, user.id), inArray(orders.status, [...CONFIRMED_STATUSES])),
  });
  if (order) await writeCartLines([]);
}
