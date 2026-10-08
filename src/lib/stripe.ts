// The one Stripe client. Server-only: the key must never reach the browser.
// Use a restricted key (`rk_…`) with Checkout Sessions write and
// PaymentIntents read. Created lazily so builds don't need the key.
import "server-only";
import Stripe from "stripe";

let client: Stripe | undefined;

export function stripe(): Stripe {
  if (!client) {
    const key = process.env.STRIPE_SECRET_KEY;
    if (!key) throw new Error("STRIPE_SECRET_KEY is not set");
    client = new Stripe(key, {
      apiVersion: "2026-08-26.dahlia",
      appInfo: { name: "claude-shop" },
    });
  }
  return client;
}
