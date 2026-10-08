import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { AdminHeader } from "@/components/admin/admin-header";
import { getOrderForAdmin, type AdminOrder } from "@/db/admin-queries";
import { requireAdmin } from "@/lib/auth/session";
import { formatPrice } from "@/lib/format";
import { orderStatusLabel } from "@/lib/order-status";

export const metadata: Metadata = { title: "Order · Admin", robots: { index: false } };
export const dynamic = "force-dynamic";

const dateFormat = new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short" });
const when = (date: Date | null) =>
  date ? <time dateTime={date.toISOString()}>{dateFormat.format(date)}</time> : <span className="text-graphite">—</span>;

/** What an admin should do about an order in each state. Read-only page: no actions here yet. */
const guidance: Partial<Record<AdminOrder["status"], string>> = {
  paid: "Paid in full. Ready to fulfil.",
  processing: "The customer’s bank is still completing the payment. Its stock stays held; don’t ship yet.",
  needs_review:
    "Payment arrived but didn’t match the order (amount or reference), or arrived after the checkout had closed. Check it in the Stripe Dashboard, then refund or fulfil it by hand.",
  pending_payment: "Checkout in progress. Its stock is held until the customer pays or the checkout expires.",
};

export default async function Page({ params }: PageProps<"/admin/orders/[id]">) {
  const { id } = await params;
  await requireAdmin(`/admin/orders/${id}`);
  const order = await getOrderForAdmin(id);
  if (!order) notFound();

  const status = orderStatusLabel[order.status];
  const reference = order.id.slice(0, 8).toUpperCase();
  const held = order.items.reduce((sum, i) => sum + i.reservedQuantity, 0);
  const note = guidance[order.status];

  return (
    <div className="flex max-w-3xl flex-col gap-(--space-block)">
      <AdminHeader title={`Order ${reference}`} back={{ href: "/admin/orders", label: "Orders" }} />
      <div className="flex flex-col gap-2">
        <p className={`text-subtitle ${status.tone}`}>{status.label}</p>
        {note && <p className="text-body text-graphite">{note}</p>}
      </div>

      <Section title="Customer">
        <dl className="flex flex-col gap-3 text-ui">
          <Row term="Name">{order.user?.name ?? <span className="text-graphite">Account deleted</span>}</Row>
          <Row term="Order email">
            <span className="[overflow-wrap:anywhere]">{order.email}</span>
          </Row>
          {order.user && order.user.email !== order.email && (
            <Row term="Account email">
              <span className="[overflow-wrap:anywhere]">{order.user.email}</span>
            </Row>
          )}
          <Row term="Ship to">
            {order.shipping ? (
              <address className="not-italic">
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
                {order.shipping.address.country && (
                  <>
                    <br />
                    {order.shipping.address.country}
                  </>
                )}
              </address>
            ) : (
              <span className="text-graphite">Not collected yet</span>
            )}
          </Row>
        </dl>
      </Section>

      <Section title="Items">
        <ul className="divide-y divide-rule">
          {order.items.map((item) => (
            <li key={item.id} className="grid grid-cols-[3.5rem_minmax(0,1fr)_auto] items-start gap-4 py-4">
              <div className="media-product" aria-hidden="true">
                {item.imageUrl && <Image src={item.imageUrl} alt="" fill sizes="3.5rem" />}
              </div>
              <div className="flex min-w-0 flex-col gap-0.5">
                {item.productId ? (
                  <Link href={`/admin/products/${item.productId}`} className="text-ui font-medium hover:text-lapis">
                    {item.productName}
                  </Link>
                ) : (
                  <span className="text-ui font-medium">{item.productName} (deleted)</span>
                )}
                <span className="text-meta">
                  {item.sku} · {item.colour}
                  {item.size && <> · Size {item.size}</>}
                </span>
                <span className="text-sm">
                  {item.quantity} × {formatPrice(item.unitPriceCents / 100)}
                  {item.reservedQuantity < item.quantity && (
                    <span className="text-graphite">
                      {" "}
                      · {item.reservedQuantity} from stock, {item.quantity - item.reservedQuantity} made to order
                    </span>
                  )}
                </span>
              </div>
              <p className="text-ui">{formatPrice(item.lineTotalCents / 100)}</p>
            </li>
          ))}
        </ul>
        <dl className="flex flex-col gap-2 rule-t pt-4 text-ui">
          <div className="flex items-baseline justify-between gap-4">
            <dt>Subtotal</dt>
            <dd>{formatPrice(order.subtotalCents / 100)}</dd>
          </div>
          <div className="flex items-baseline justify-between gap-4 rule-t pt-3 mt-1">
            <dt className="font-medium">Total ({order.currency.toUpperCase()})</dt>
            <dd className="text-subtitle">{formatPrice(order.totalCents / 100)}</dd>
          </div>
        </dl>
      </Section>

      <Section title="Payment and stock">
        <dl className="flex flex-col gap-3 text-ui">
          <Row term="Placed">{when(order.createdAt)}</Row>
          <Row term="Paid">{when(order.paidAt)}</Row>
          <Row term="Stripe reports">{order.stripePaymentStatus ?? <span className="text-graphite">Nothing yet</span>}</Row>
          <Row term="Checkout session">
            <Code value={order.stripeCheckoutSessionId} />
          </Row>
          <Row term="Payment intent">
            <Code value={order.stripePaymentIntentId} />
          </Row>
          <Row term="Checkout expires">{when(order.expiresAt)}</Row>
          <Row term="Stock">
            {order.stockReleasedAt ? (
              <>Returned to stock {when(order.stockReleasedAt)}</>
            ) : held > 0 ? (
              `${held} ${held === 1 ? "unit" : "units"} taken from stock`
            ) : (
              <span className="text-graphite">None taken (made to order)</span>
            )}
          </Row>
          <Row term="Order ID">
            <Code value={order.id} />
          </Row>
        </dl>
        <p className="text-meta">Search the Stripe Dashboard for the session or payment intent to see the payment itself.</p>
      </Section>
    </div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  const id = `${title.toLowerCase().replace(/\W+/g, "-")}-heading`;
  return (
    <section aria-labelledby={id} className="flex flex-col gap-4 rule-t pt-(--space-block)">
      <h2 id={id} className="text-subtitle">
        {title}
      </h2>
      {children}
    </section>
  );
}

function Row({ term, children }: { term: string; children: ReactNode }) {
  return (
    <div className="grid gap-x-8 gap-y-1 sm:grid-cols-[10rem_minmax(0,1fr)]">
      <dt className="text-meta">{term}</dt>
      <dd className="min-w-0">{children}</dd>
    </div>
  );
}

function Code({ value }: { value: string | null }) {
  if (!value) return <span className="text-graphite">—</span>;
  return <code className="text-sm [overflow-wrap:anywhere]">{value}</code>;
}
