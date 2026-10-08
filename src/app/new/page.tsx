import type { Metadata } from "next";
import Link from "next/link";
import { ProductCard } from "@/components/product-card";
import { getNewArrivals } from "@/db/queries";

// Twenty-four fills whole rows at two, three and four columns.
const ARRIVALS_LIMIT = 24;

export const metadata: Metadata = {
  title: "New arrivals",
  description: "The latest ready-to-wear, bags, shoes and jewelry at Claude Shop.",
};

// Rendered per request so price and stock always come from the database.
export const dynamic = "force-dynamic";

export default async function NewArrivalsPage() {
  const products = await getNewArrivals(ARRIVALS_LIMIT);

  return (
    <>
      <section
        className="container-page flex flex-col gap-3 pt-8 pb-(--space-block) lg:pt-12"
        aria-labelledby="new-arrivals"
      >
        <nav aria-label="Breadcrumb">
          <ol className="flex flex-wrap gap-2 text-meta">
            <li>
              <Link href="/" className="link-quiet">
                Home
              </Link>
            </li>
            <li aria-hidden="true">/</li>
            <li aria-current="page">New arrivals</li>
          </ol>
        </nav>
        <div className="flex flex-wrap items-baseline justify-between gap-4">
          <h1 id="new-arrivals" className="text-headline">
            New arrivals
          </h1>
          {products.length > 0 && (
            <p className="text-meta">
              {products.length} {products.length === 1 ? "piece" : "pieces"}
            </p>
          )}
        </div>
        <p className="text-body text-graphite">
          The latest pieces to reach the studio, newest first.
        </p>
      </section>

      {products.length > 0 ? (
        <section
          className="container-page pb-(--space-section)"
          aria-label="Products"
        >
          <ul className="grid-products">
            {products.map((product) => (
              <li key={product.slug}>
                <ProductCard product={product} />
              </li>
            ))}
          </ul>
        </section>
      ) : (
        <section className="section container-page stack rule-t">
          <p className="text-body">
            Nothing new just yet. The next collection is on its way.
          </p>
          <div>
            <Link href="/" className="btn btn-primary">
              Go to the homepage
            </Link>
          </div>
        </section>
      )}
    </>
  );
}
