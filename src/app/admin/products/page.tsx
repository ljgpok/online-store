import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { AdminHeader } from "@/components/admin/admin-header";
import { Price } from "@/components/price";
import { listProductsForAdmin, type ProductListRow } from "@/db/admin-queries";
import { requireAdmin } from "@/lib/auth/session";
import { stockCopy, stockState, stockTone } from "@/lib/stock";

export const metadata: Metadata = { title: "Products · Admin", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function Page({ searchParams }: PageProps<"/admin/products">) {
  const params = await searchParams;
  await requireAdmin("/admin/products");

  const q = typeof params.q === "string" ? params.q.trim().slice(0, 80) : "";
  const rows = await listProductsForAdmin({ q });

  return (
    <>
      <AdminHeader title="Products">
        <Link href="/admin/products/new" className="btn btn-primary btn-sm">
          New product
        </Link>
      </AdminHeader>

      <form role="search" className="flex gap-2" action="/admin/products">
        <label htmlFor="product-search" className="visually-hidden">
          Search by name, SKU or URL name
        </label>
        <input id="product-search" name="q" type="search" defaultValue={q} placeholder="Name, SKU or URL name" className="input min-h-9 w-56" />
        <button type="submit" className="btn btn-secondary btn-sm">
          Search
        </button>
      </form>

      {rows.length === 0 ? (
        <p className="text-body text-graphite rule-t pt-(--space-block)">
          {q ? `No products match “${q}”.` : "No products yet."}
        </p>
      ) : (
        <>
          <p className="text-meta" aria-live="polite">
            {rows.length} {rows.length === 1 ? "product" : "products"}
          </p>
          <ul className="divide-y divide-rule rule-y">
            {rows.map((row) => (
              <ProductRow key={row.id} row={row} />
            ))}
          </ul>
        </>
      )}
    </>
  );
}

function ProductRow({ row }: { row: ProductListRow }) {
  const state = stockState(row.stockQuantity, row.madeToOrder);
  return (
    <li className="grid grid-cols-[3rem_minmax(0,1fr)] gap-x-4 gap-y-2 py-4 sm:grid-cols-[3rem_minmax(0,1fr)_9rem_10rem_auto] sm:items-center">
      <div className="media-product w-12 row-span-2 sm:row-span-1" aria-hidden="true">
        {row.image && <Image src={row.image} alt="" fill sizes="3rem" />}
      </div>
      <div className="flex min-w-0 flex-col gap-0.5">
        <Link href={`/admin/products/${row.id}`} className="text-ui font-medium hover:text-lapis">
          {row.name}
        </Link>
        <span className="text-meta [overflow-wrap:anywhere]">
          {row.sku} · {row.category} · {row.colour}
        </span>
      </div>
      <div className="col-start-2 flex flex-wrap gap-x-4 gap-y-1 text-sm sm:col-start-auto sm:contents">
        <span className="sm:text-right">
          <Price price={row.priceCents / 100} salePrice={row.salePriceCents === null ? undefined : row.salePriceCents / 100} />
        </span>
        <span className={stockTone(state)}>{stockCopy(state, row.stockQuantity)}</span>
        <span className="flex gap-4">
          <Link href={`/admin/products/${row.id}`} className="link text-sm">
            Edit<span className="visually-hidden"> {row.name}</span>
          </Link>
          <Link href={`/products/${row.slug}`} className="link-quiet text-sm underline underline-offset-4">
            View<span className="visually-hidden"> {row.name} in the shop</span>
          </Link>
        </span>
      </div>
    </li>
  );
}
