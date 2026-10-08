import type { Metadata } from "next";
import { AdminHeader } from "@/components/admin/admin-header";
import { FilterChips } from "@/components/admin/filter-chips";
import { StockTable } from "@/components/admin/stock-table";
import { listStockForAdmin, STOCK_FILTERS, type StockFilter } from "@/db/admin-queries";
import { requireAdmin } from "@/lib/auth/session";
import { LOW_STOCK_THRESHOLD } from "@/lib/stock";

export const metadata: Metadata = { title: "Stock · Admin", robots: { index: false } };
// Stock moves with every checkout, so always read the latest.
export const dynamic = "force-dynamic";

const filterLabels: Record<StockFilter, string> = {
  all: "All",
  low: `Low (1–${LOW_STOCK_THRESHOLD})`,
  out: "Sold out",
  "made-to-order": "Made to order",
};

export default async function Page({ searchParams }: PageProps<"/admin/stock">) {
  const params = await searchParams;
  await requireAdmin("/admin/stock");

  const show = STOCK_FILTERS.find((f) => f === params.show) ?? "all";
  const q = typeof params.q === "string" ? params.q.trim().slice(0, 80) : "";
  const rows = await listStockForAdmin({ show, q });
  const href = (f: StockFilter) => {
    const sp = new URLSearchParams();
    if (f !== "all") sp.set("show", f);
    if (q) sp.set("q", q);
    const s = sp.toString();
    return s ? `/admin/stock?${s}` : "/admin/stock";
  };

  return (
    <>
      <div className="flex flex-col gap-2">
        <AdminHeader title="Stock" />
        <p className="text-sm text-graphite max-w-(--container-copy)">
          Available is what customers can buy now. It excludes units held in open checkouts, which come
          back automatically if a checkout isn’t completed within 30 minutes. Use “Adjust by” for
          deliveries and corrections; “Set to” only saves if stock hasn’t changed since you loaded
          this page.
        </p>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-4">
        <FilterChips
          label="Filter stock"
          current={show}
          options={STOCK_FILTERS.map((f) => ({ value: f, label: filterLabels[f], href: href(f) }))}
        />
        <form role="search" className="flex gap-2" action="/admin/stock">
          {show !== "all" && <input type="hidden" name="show" value={show} />}
          <label htmlFor="stock-search" className="visually-hidden">
            Search by name, SKU or slug
          </label>
          <input
            id="stock-search"
            name="q"
            type="search"
            defaultValue={q}
            placeholder="Name, SKU or slug"
            className="input min-h-9 w-56"
          />
          <button type="submit" className="btn btn-secondary btn-sm">
            Search
          </button>
        </form>
      </div>

      {rows.length === 0 ? (
        <p className="text-body text-graphite rule-t pt-(--space-block)">
          No products match{q ? ` “${q}”` : ""} in this view.
        </p>
      ) : (
        <>
          <p className="text-meta" aria-live="polite">
            {rows.length} {rows.length === 1 ? "product" : "products"}
          </p>
          <StockTable rows={rows} />
        </>
      )}
    </>
  );
}
