// Where Stripe sends the customer after paying. Reaching this URL proves
// nothing: the session id is only used to find the customer's own order, and
// its status comes from Stripe's API (or has already come from the webhook).
import { and, eq } from "drizzle-orm";
import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/db";
import { orders } from "@/db/schema";
import { getSession } from "@/lib/auth/session";
import { readCartOrderId, writeCartLines } from "@/lib/cart/cookie";
import { syncSession } from "@/lib/checkout/orders";

export const dynamic = "force-dynamic";

const SESSION_ID = /^cs_(test|live)_[A-Za-z0-9]+$/;

export async function GET(request: NextRequest) {
  const to = (path: string) => NextResponse.redirect(new URL(path, request.url), 303);
  const sessionId = request.nextUrl.searchParams.get("session_id") ?? "";

  const current = await getSession();
  if (!current) {
    const back = `/checkout/return?session_id=${encodeURIComponent(sessionId)}`;
    return to(`/sign-in?next=${encodeURIComponent(back)}`);
  }
  if (!SESSION_ID.test(sessionId)) return new Response("Not found", { status: 404 });

  const where = and(eq(orders.stripeCheckoutSessionId, sessionId), eq(orders.userId, current.user.id));
  const order = await db.query.orders.findFirst({ columns: { id: true }, where });
  if (!order) return new Response("Not found", { status: 404 });

  try {
    // In case the webhook hasn't arrived yet. Same rules, Stripe's data.
    await syncSession(sessionId);
  } catch (error) {
    console.error(`[checkout] Couldn't sync session ${sessionId}`, error);
  }

  const { status } = (await db.query.orders.findFirst({ columns: { status: true }, where }))!;
  switch (status) {
    case "paid":
    case "processing":
    case "needs_review":
      // The payment is with Stripe, so the bag that became this order is done.
      if ((await readCartOrderId()) === order.id) await writeCartLines([]);
      return to(`/account/orders/${order.id}`);
    case "pending_payment":
      // Stripe sent the customer here after checkout, but we haven't had the
      // confirmation yet. The order page waits for it; nothing is assumed.
      return to(`/account/orders/${order.id}`);
    case "payment_failed":
      return to("/bag?checkout=failed");
    case "cancelled":
      return to("/bag?checkout=replaced");
    case "expired":
      return to("/bag?checkout=expired");
  }
}
