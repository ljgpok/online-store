// Stripe webhook: the source of truth for payment. Subscribe the endpoint to
// checkout.session.completed, .async_payment_succeeded, .async_payment_failed
// and .expired. Locally: `stripe listen --forward-to localhost:3000/api/stripe/webhook`.
import { eq } from "drizzle-orm";
import type Stripe from "stripe";
import { db } from "@/db";
import { stripeEvents } from "@/db/schema";
import { applyEvent } from "@/lib/checkout/orders";
import { stripe } from "@/lib/stripe";

export async function POST(request: Request) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) {
    console.error("[stripe webhook] STRIPE_WEBHOOK_SECRET is not set");
    return new Response("Webhook not configured", { status: 500 });
  }
  const signature = request.headers.get("stripe-signature");
  if (!signature) return new Response("Missing signature", { status: 400 });

  // The signature covers the exact raw body, so read it as text, unparsed.
  const body = await request.text();
  let event: Stripe.Event;
  try {
    event = stripe().webhooks.constructEvent(body, signature, secret);
  } catch {
    return new Response("Invalid signature", { status: 400 });
  }

  // Record the event; a redelivery that was already handled stops here.
  const inserted = await db
    .insert(stripeEvents)
    .values({ id: event.id, type: event.type, stripeCreatedAt: new Date(event.created * 1000) })
    .onConflictDoNothing()
    .returning({ id: stripeEvents.id });
  if (inserted.length === 0) {
    const existing = await db.query.stripeEvents.findFirst({ where: eq(stripeEvents.id, event.id) });
    if (existing?.processedAt) return Response.json({ received: true, duplicate: true });
  }

  try {
    await applyEvent(event);
  } catch (error) {
    // Left unprocessed, so Stripe's retry gets handled. Order changes are
    // conditional, so a partial first attempt can't apply twice.
    console.error(`[stripe webhook] Failed to handle ${event.type} ${event.id}`, error);
    return new Response("Handler error", { status: 500 });
  }

  await db.update(stripeEvents).set({ processedAt: new Date() }).where(eq(stripeEvents.id, event.id));
  return Response.json({ received: true });
}
