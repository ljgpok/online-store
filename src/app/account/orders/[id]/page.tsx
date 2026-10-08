import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { OrderStatusWatcher } from "@/components/orders/order-status-watcher";
import { getOrderForUser, type OrderView } from "@/db/queries";
import type { OrderStatus } from "@/db/schema";
import { requireUser } from "@/lib/auth/session";
import { readCartOrderId } from "@/lib/cart/cookie";
import { formatPrice } from "@/lib/format";
import { orderStatusLabel } from "@/lib/order-status";

const reference = (id: string) => id.slice(0, 8).toUpperCase();

export async function generateMetadata({ params }: PageProps<"/account/orders/[id]">): Promise<Metadata> {
  const { id } = await params;
  const { user } = await requireUser(`/account/orders/${id}`);
  const order = await getOrderForUser(id, user.id);
  return { title: order ? `Order ${reference(order.id)}` : "Order", robots: { index: false } };
}

// Status changes arrive by webhook, so always read the latest.
export const dynamic = "force-dynamic";

const dateFormat = new Intl.DateTimeFormat("en-US", { dateStyle: "long" });

const statusCopy: Record<OrderStatus, { title: string; body: string; tone: string }> = {
  paid: {
    title: "Thank you. Your order is confirmed.",
    // No receipt promise: Stripe only emails one when that's enabled in the
    // Dashboard, and never in test mode.
    body: "Your payment has been received. This page is your order confirmation, and you can find it any time under Orders in your account.",
    tone: "text-confirm",
  },
  processing: {
    title: "Your payment is processing.",
    body: "Your bank is completing the payment, which can take a few days. Your pieces are held for you, and this order updates when the payment clears.",
    tone: "text-black",
  },
  needs_review: {
    title: "We’re checking your order.",
    body: "Your payment was received, but something didn’t match. Our client services team will review it and contact you.",
    tone: "text-black",
  },
  // Can't tell "paid, confirmation on its way" from "never finished paying",
  // so this covers both without assuming either.
  pending_payment: {
    title: "Waiting for payment",
    body: "If you’ve just paid, Stripe usually confirms within a few seconds and this page updates by itself, so please don’t pay again. If you didn’t finish paying, nothing has been charged and your pieces are still in your bag.",
    tone: "text-black",
  },
  payment_failed: {
    title: "Your payment didn’t go through.",
    body: "Your bank declined the payment, so this order wasn’t placed. Your pieces are back in stock if you’d like to try again.",
    tone: "text-alert",
  },
  expired: {
    title: "This checkout ended without payment.",
    body: "Nothing was charged and the reservation was released.",
    tone: "text-graphite",
  },
  cancelled: {
    title: "This checkout was replaced.",
    body: "Nothing was charged. A newer checkout or your bag has the latest pieces.",
    tone: "text-graphite",
  },
};

export default async function OrderPage({ params }: PageProps<"/account/orders/[id]">) {
  const { id } = await params;
  const { user } = await requireUser(`/account/orders/${id}`);
  const order = await getOrderForUser(id, user.id);
  if (!order) notFound();

  const copy = statusCopy[order.status];
  const status = orderStatusLabel[order.status];
  const awaiting = order.status === "pending_payment";
  const confirmed = order.status === "paid" || order.status === "processing" || order.status === "needs_review";
  // Only the bag that was checked out as this order is cleared.
  const clearBag = confirmed && (await readCartOrderId()) === order.id;

  return (
    <div className="stack max-w-(--container-copy)">
      <Link href="/account/orders" className="link-quiet text-sm self-start">
        <span aria-hidden="true">← </span>All orders
      </Link>
      <OrderStatusWatcher orderId={order.id} awaitingConfirmation={awaiting} clearBag={clearBag}>
        <p className="text-meta">Order {reference(order.id)}</p>
        <h1 className={`text-title flex items-center gap-3 ${copy.tone}`}>
          {awaiting && (
            <span
              aria-hidden="true"
              className="size-6 shrink-0 animate-spin rounded-full border-2 border-current border-r-transparent"
            />
          )}
          {copy.title}
        </h1>
        <p className="text-body text-graphite">{copy.body}</p>
        {(order.status === "payment_failed" || order.status === "expired") && (
          <div className="pt-2">
            <Link href="/bag" className="btn btn-secondary">
              Go to your bag
            </Link>
          </div>
        )}
        {confirmed && (
          <div className="pt-2">
            <Link href="/new" className="btn btn-secondary">
              Continue shopping
            </Link>
          </div>
        )}
      </OrderStatusWatcher>

      <section aria-labelledby="details-heading" className="rule-t pt-(--space-block)">
        <h2 id="details-heading" className="text-subtitle mb-4">
          Order details
        </h2>
        <dl className="flex flex-col gap-3 text-ui">
          <DetailRow term="Order number">{reference(order.id)}</DetailRow>
          <DetailRow term="Placed">
            <time dateTime={order.createdAt.toISOString()}>{dateFormat.format(order.createdAt)}</time>
          </DetailRow>
          <DetailRow term="Payment">
            <span className={status.tone}>{status.label}</span>
            {order.paidAt && (
              <span className="text-graphite">
                {" "}
                on <time dateTime={order.paidAt.toISOString()}>{dateFormat.format(order.paidAt)}</time>
              </span>
            )}
          </DetailRow>
          <DetailRow term="Email">
            <span className="[overflow-wrap:anywhere]">{order.email}</span>
          </DetailRow>
        </dl>
      </section>

      <section aria-labelledby="items-heading" className="rule-t pt-(--space-block)">
        <h2 id="items-heading" className="text-subtitle mb-4">
          Items
        </h2>
        <ul className="divide-y divide-rule">
          {order.items.map((item, i) => (
            <OrderItem key={i} item={item} />
          ))}
        </ul>
        <dl className="flex flex-col gap-2 rule-t pt-4 text-ui">
          <div className="flex items-baseline justify-between gap-4">
            <dt>Subtotal</dt>
            <dd>{formatPrice(order.subtotal)}</dd>
          </div>
          <div className="flex items-baseline justify-between gap-4">
            <dt>Shipping</dt>
            <dd>Free</dd>
          </div>
          <div className="flex items-baseline justify-between gap-4 rule-t pt-3 mt-1">
            <dt className="font-medium">
              {order.status === "paid" || order.status === "needs_review" ? "Total paid" : "Total"}
            </dt>
            <dd className="text-subtitle">{formatPrice(order.total)}</dd>
          </div>
        </dl>
        <p className="text-meta mt-2">Prices are as they were when you checked out.</p>
      </section>

      {order.shipping && (
        <section aria-labelledby="shipping-heading" className="rule-t pt-(--space-block)">
          <h2 id="shipping-heading" className="text-subtitle mb-4">
            Shipping to
          </h2>
          <address className="text-ui not-italic">
            {order.shipping.name}
            <br />
            {order.shipping.address.line1}
            {order.shipping.address.line2 && (
              <>
                <br />
                {order.shipping.address.line2}
              </>
            )}
            <br />
            {[order.shipping.address.city, order.shipping.address.state, order.shipping.address.postalCode]
              .filter(Boolean)
              .join(", ")}
          </address>
        </section>
      )}
    </div>
  );
}

function DetailRow({ term, children }: { term: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-x-8 gap-y-1 sm:grid-cols-[10rem_minmax(0,1fr)]">
      <dt className="text-meta">{term}</dt>
      <dd>{children}</dd>
    </div>
  );
}

function OrderItem({ item }: { item: OrderView["items"][number] }) {
  const href = `/products/${item.slug}`;
  return (
    <li className="grid grid-cols-[4.5rem_minmax(0,1fr)_auto] items-start gap-4 py-4">
      <div className="media-product">
        {item.image && <Image src={item.image} alt="" fill sizes="4.5rem" />}
      </div>
      <div className="flex min-w-0 flex-col gap-1">
        {/* Link only while the product still exists; the order keeps its own copy. */}
        {item.productAvailable ? (
          <Link href={href} className="text-ui font-medium hover:text-lapis">
            {item.name}
          </Link>
        ) : (
          <span className="text-ui font-medium">{item.name}</span>
        )}
        <span className="text-meta">
          {item.colour}
          {item.size && <> · Size {item.size}</>}
        </span>
        <span className="text-sm">
          <span className="visually-hidden">Quantity </span>
          {item.quantity} × {formatPrice(item.unitPrice)}
        </span>
      </div>
      <p className="text-ui">
        <span className="visually-hidden">Line total </span>
        {formatPrice(item.lineTotal)}
      </p>
    </li>
  );
}
