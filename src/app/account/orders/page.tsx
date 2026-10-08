import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { getOrdersForUser, type OrderSummary } from "@/db/queries";
import { requireUser } from "@/lib/auth/session";
import { formatPrice } from "@/lib/format";
import { orderStatusLabel } from "@/lib/order-status";

export const metadata: Metadata = {
  title: "Orders",
  robots: { index: false },
};

// Payment status changes by webhook, so always read the latest.
export const dynamic = "force-dynamic";

const dateFormat = new Intl.DateTimeFormat("en-US", { dateStyle: "long" });

export default async function OrdersPage() {
  const { user } = await requireUser("/account/orders");
  const orders = await getOrdersForUser(user.id);

  return (
    <div className="stack max-w-(--container-copy)">
      <div className="flex flex-wrap items-baseline justify-between gap-4">
        <h1 className="text-title">Orders</h1>
        {orders.length > 0 && (
          <p className="text-meta">
            {orders.length} {orders.length === 1 ? "order" : "orders"}
          </p>
        )}
      </div>

      {orders.length === 0 ? (
        <section aria-label="No orders" className="stack rule-t pt-(--space-block)">
          <p className="text-subtitle">You haven’t placed any orders yet.</p>
          <p className="text-body text-graphite">
            When you do, they’ll appear here with their payment status and details.
          </p>
          <div>
            <Link href="/new" className="btn btn-primary">
              Shop new arrivals
            </Link>
          </div>
        </section>
      ) : (
        <ul className="divide-y divide-rule rule-y">
          {orders.map((order) => (
            <OrderRow key={order.id} order={order} />
          ))}
        </ul>
      )}
    </div>
  );
}

function OrderRow({ order }: { order: OrderSummary }) {
  const status = orderStatusLabel[order.status];
  const reference = order.id.slice(0, 8).toUpperCase();
  const others = order.lineCount - 1;

  return (
    <li>
      {/* The whole row opens the order; the heading gives it a clear name. */}
      <Link
        href={`/account/orders/${order.id}`}
        className="group grid grid-cols-[minmax(0,1fr)_auto] items-start gap-x-4 gap-y-3 py-5 sm:grid-cols-[7.5rem_minmax(0,1fr)_auto] sm:gap-x-6"
      >
        <div className="col-span-2 flex gap-1 sm:col-span-1" aria-hidden="true">
          {order.images.length > 0 ? (
            order.images.map((src, i) => (
              <div key={i} className="media-product w-10 shrink-0">
                <Image src={src} alt="" fill sizes="2.5rem" />
              </div>
            ))
          ) : (
            <div className="media-product w-10 shrink-0" />
          )}
        </div>

        <div className="flex min-w-0 flex-col gap-1">
          <h2 className="text-ui font-medium group-hover:text-lapis">
            Order {reference}
            <span className="visually-hidden">, {status.label}</span>
          </h2>
          <p className="text-meta">
            <time dateTime={order.date.toISOString()}>{dateFormat.format(order.date)}</time>
            {" · "}
            {order.itemCount} {order.itemCount === 1 ? "item" : "items"}
          </p>
          <p className="text-sm truncate">
            {order.firstItemName}
            {others > 0 && <span className="text-graphite"> and {others} more</span>}
          </p>
          <p className={`text-sm ${status.tone}`} aria-hidden="true">
            {status.label}
          </p>
        </div>

        <div className="flex flex-col items-end gap-1 text-right">
          <p className="text-ui">
            <span className="visually-hidden">Total </span>
            {formatPrice(order.total)}
          </p>
          <span className="text-sm text-graphite underline underline-offset-4 group-hover:text-black">
            View<span className="visually-hidden"> order {reference}</span>
          </span>
        </div>
      </Link>
    </li>
  );
}
