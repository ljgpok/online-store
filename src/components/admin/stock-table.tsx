import Image from "next/image";
import Link from "next/link";
import type { StockRow } from "@/db/admin-queries";
import { stockCopy, stockState, stockTone } from "@/lib/stock";
import { StockRowForm } from "./stock-row-form";

export function StockTable({ rows }: { rows: StockRow[] }) {
  return (
    <>
      {/* Phones and small tablets: one card per product, form under the numbers. */}
      <ul className="divide-y divide-rule rule-y md:hidden">
        {rows.map((row) => (
          <StockCard key={row.id} row={row} />
        ))}
      </ul>
      {/* Wider screens: a table. It scrolls inside this wrapper if squeezed; the page doesn't. */}
      <div className="-mx-(--gutter) hidden overflow-x-auto px-(--gutter) md:block">
      <table className="w-full min-w-[56rem] border-collapse text-left">
        <caption className="visually-hidden">Stock by product</caption>
        <thead>
          <tr className="rule-b text-meta">
            <th scope="col" className="py-3 pr-4 font-normal">Product</th>
            <th scope="col" className="py-3 pr-4 text-right font-normal">Available to sell</th>
            <th scope="col" className="py-3 pr-4 text-right font-normal">Held in checkout</th>
            <th scope="col" className="py-3 pr-4 font-normal">Shop shows</th>
            <th scope="col" className="py-3 font-normal">Update</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-rule">
          {rows.map((row) => {
            const state = stockState(row.available, row.madeToOrder);
            return (
              <tr key={row.id} className="align-top">
                <td className="py-4 pr-4">
                  <ProductCell row={row} />
                </td>
                <td className="py-4 pr-4 text-right text-subtitle tabular-nums">{row.available}</td>
                <td className={`py-4 pr-4 text-right text-ui tabular-nums ${row.held ? "" : "text-graphite"}`}>
                  {row.held}
                </td>
                <td className="py-4 pr-4 text-sm">
                  <span className={stockTone(state)}>{stockCopy(state, row.available)}</span>
                  {row.madeToOrder && state !== "made-to-order" && (
                    <span className="text-meta block">Made to order when sold out</span>
                  )}
                </td>
                <td className="py-4">
                  <StockRowForm productId={row.id} productName={row.name} available={row.available} />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      </div>
    </>
  );
}

function ProductCell({ row }: { row: StockRow }) {
  return (
    <div className="flex gap-3">
      <div className="media-product w-12 shrink-0" aria-hidden="true">
        {row.image && <Image src={row.image} alt="" fill sizes="3rem" />}
      </div>
      <div className="flex min-w-0 flex-col gap-0.5">
        <span className="text-ui font-medium">{row.name}</span>
        <span className="text-meta [overflow-wrap:anywhere]">
          {row.sku} · {row.category}
        </span>
        <Link href={`/products/${row.slug}`} className="link-quiet text-sm underline underline-offset-4 self-start">
          View in shop<span className="visually-hidden">: {row.name}</span>
        </Link>
      </div>
    </div>
  );
}

function StockCard({ row }: { row: StockRow }) {
  const state = stockState(row.available, row.madeToOrder);
  return (
    <li className="flex flex-col gap-4 py-5">
      <ProductCell row={row} />
      <dl className="grid grid-cols-3 gap-3">
        <div>
          <dt className="text-meta">Available</dt>
          <dd className="text-subtitle tabular-nums">{row.available}</dd>
        </div>
        <div>
          <dt className="text-meta">Held</dt>
          <dd className={`text-subtitle tabular-nums ${row.held ? "" : "text-graphite"}`}>{row.held}</dd>
        </div>
        <div>
          <dt className="text-meta">Shop shows</dt>
          <dd className={`text-sm ${stockTone(state)}`}>{stockCopy(state, row.available)}</dd>
        </div>
      </dl>
      <StockRowForm productId={row.id} productName={row.name} available={row.available} idPrefix="stock-card" />
    </li>
  );
}
