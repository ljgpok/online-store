import type { Metadata } from "next";
import Link from "next/link";
import { AdminHeader } from "@/components/admin/admin-header";
import { FilterChips } from "@/components/admin/filter-chips";
import { listOrdersForAdmin, ORDER_FILTERS, type AdminOrderRow, type OrderFilter } from "@/db/admin-queries";
import { requireAdmin } from "@/lib/auth/session";
import { formatPrice } from "@/lib/format";
import { orderStatusLabel } from "@/lib/order-status";

export const metadata: Metadata = { title: "Orders · Admin", robots: { index: false } };
// Orders change with every checkout and webhook, so always read the latest.
export const dynamic = "force-dynamic";

const filterLabels: Record<OrderFilter, string> = {
  all: "All",
  paid: "Paid",
  open: "In checkout",
  review: "Needs review",
  closed: "Not completed",
};

const dateFormat = new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short" });

export default async function Page({ searchParams }: PageProps<"/admin/orders">) {
  const params = await searchParams;
  await requireAdmin("/admin/orders");

  const show = ORDER_FILTERS.find((f) => f === params.show) ?? "all";
  const q = typeof params.q === "string" ? params.q.trim().slice(0, 80) : "";
  const rows = await listOrdersForAdmin({ show, q });
  const href = (f: OrderFilter) => {
    const sp = new URLSearchParams();
    if (f !== "all") sp.set("show", f);
    if (q) sp.set("q", q);
    const s = sp.toString();
    return s ? `/admin/orders?${s}` : "/admin/orders";
  };

  return (
    <>
      <AdminHeader title="Orders" />

      <div className="flex flex-wrap items-center justify-between gap-4">
        <FilterChips
          label="Filter orders"
          current={show}
          options={ORDER_FILTERS.map((f) => ({ value: f, label: filterLabels[f], href: href(f) }))}
        />
        <form role="search" className="flex gap-2" action="/admin/orders">
          {show !== "all" && <input type="hidden" name="show" value={show} />}
          <label htmlFor="order-search" className="visually-hidden">
            Search by order number or email
          </label>
          <input id="order-search" name="q" type="search" defaultValue={q} placeholder="Order number or email" className="input min-h-9 w-56" />
          <button type="submit" className="btn btn-secondary btn-sm">
            Search
          </button>
        </form>
      </div>

      {rows.length === 0 ? (
        <p className="text-body text-graphite rule-t pt-(--space-block)">
          No orders match{q ? ` “${q}”` : ""} in this view.
        </p>
      ) : (
        <>
          <p className="text-meta" aria-live="polite">
            {rows.length} {rows.length === 1 ? "order" : "orders"}
            {rows.length === 200 && " (the newest 200)"}
          </p>
          <ul className="divide-y divide-rule rule-y">
            {rows.map((row) => (
              <OrderRow key={row.id} row={row} />
            ))}
          </ul>
        </>
      )}
    </>
  );
}

function OrderRow({ row }: { row: AdminOrderRow }) {
  const status = orderStatusLabel[row.status];
  const reference = row.id.slice(0, 8).toUpperCase();
  return (
    <li>
      <Link
        href={`/admin/orders/${row.id}`}
        className="group grid grid-cols-[minmax(0,1fr)_auto] gap-x-4 gap-y-1 py-4 sm:grid-cols-[8rem_minmax(0,1fr)_auto_7rem] sm:items-baseline"
      >
        <span className="text-ui font-medium group-hover:text-lapis">Order {reference}</span>
        <span className="text-ui text-right sm:order-last">{formatPrice(row.totalCents / 100)}</span>
        <span className="min-w-0 text-sm [overflow-wrap:anywhere]">
          {row.customerName && <span>{row.customerName} · </span>}
          <span className="text-graphite">{row.email}</span>
        </span>
        <span className="col-span-2 text-meta sm:col-span-1 sm:whitespace-nowrap">
          <span className={status.tone}>{status.label}</span>
          {" · "}
          <time dateTime={row.createdAt.toISOString()}>{dateFormat.format(row.createdAt)}</time>
          {" · "}
          {row.itemCount} {row.itemCount === 1 ? "item" : "items"}
        </span>
      </Link>
    </li>
  );
}
