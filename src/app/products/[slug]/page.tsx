import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Price } from "@/components/price";
import { ProductCard } from "@/components/product-card";
import { PurchasePanel } from "@/components/purchase-panel";
import { getProductBySlug, getRelatedProducts } from "@/db/queries";
import { getCart } from "@/lib/cart/server";

// Rendered per request so price and stock always come from the database.
// Unknown slugs fall through to notFound().
export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: PageProps<"/products/[slug]">): Promise<Metadata> {
  const product = await getProductBySlug((await params).slug);
  if (!product) return {};
  return {
    title: product.name,
    description: product.description,
    openGraph: product.images[0] ? { images: [product.images[0].src] } : undefined,
  };
}

export default async function ProductPage({ params }: PageProps<"/products/[slug]">) {
  const product = await getProductBySlug((await params).slug);
  if (!product) notFound();

  const { name, sku, colour, category, price, salePrice, images, description, details } = product;
  // The header reads the bag too; `getCart` is cached, so this costs no extra query.
  const [related, cart] = await Promise.all([getRelatedProducts(product), getCart()]);
  const lines = cart.lines.filter((line) => line.slug === product.slug);
  const inBag = lines.reduce((sum, line) => sum + line.quantity, 0);
  // The bag counts units the customer's own unfinished checkout holds as theirs;
  // use the same figure so this page doesn't call their own pieces sold out.
  const stock = lines[0]?.stockUnits ?? product.stock;
  const multiple = images.length > 1;

  return (
    <>
      <section className="grid-split container-bleed" aria-label={name}>
        {/* Gallery: swipe on small screens, a vertical column of large images on desktop. */}
        <ul
          aria-label="Product images"
          className="flex snap-x snap-mandatory gap-(--grid-gap-x) overflow-x-auto [scrollbar-width:none] lg:flex-col lg:overflow-visible"
        >
          {images.length === 0 && (
            <li className="basis-full shrink-0">
              <div className="media-product" />
            </li>
          )}
          {images.map((image, i) => (
            <li
              key={image.src}
              className={`shrink-0 snap-start lg:basis-auto ${multiple ? "basis-[86%]" : "basis-full"}`}
            >
              <div className="media-product">
                <Image
                  src={image.src}
                  alt={image.alt}
                  fill
                  preload={i === 0}
                  sizes={`(width >= 64rem) 58vw, ${multiple ? "86vw" : "100vw"}`}
                />
              </div>
            </li>
          ))}
        </ul>

        <div className="px-(--gutter) pt-8 pb-(--space-section) lg:pt-12">
          <div className="flex flex-col gap-8 lg:sticky lg:top-[calc(var(--header-height)+3rem)]">
            <div className="flex flex-col gap-3">
              <nav aria-label="Breadcrumb">
                <ol className="flex flex-wrap gap-2 text-meta">
                  <li>
                    <Link href="/" className="link-quiet">
                      Home
                    </Link>
                  </li>
                  <li aria-hidden="true">/</li>
                  <li>
                    <Link href={category.href} className="link-quiet">
                      {category.name}
                    </Link>
                  </li>
                </ol>
              </nav>
              <h1 className="text-title">{name}</h1>
              <div className="text-lg">
                <Price price={price} salePrice={salePrice} />
              </div>
              <p className="text-meta">Colour: {colour}</p>
            </div>

            <PurchasePanel
              slug={product.slug}
              sizes={product.sizes}
              sizeGuide={product.sizeGuide}
              stock={stock}
              madeToOrder={product.madeToOrder}
              stockDetail={product.stockDetail}
              inBag={inBag}
            />

            <div className="rule-b">
              <Disclosure title="Description" open>
                <p className="text-body">{description}</p>
              </Disclosure>
              <Disclosure title="Details and care">
                <ul className="flex flex-col gap-1 text-sm">
                  {details.map((detail) => (
                    <li key={detail}>{detail}</li>
                  ))}
                  <li className="text-graphite">Style number {sku}</li>
                </ul>
              </Disclosure>
              <Disclosure title="Delivery and returns">
                <div className="flex flex-col gap-2 text-sm">
                  <p>
                    Free standard delivery on orders over $500, in 3 to 5
                    business days. Express delivery in 1 to 2 business days
                    for $25.
                  </p>
                  <p>
                    Return within 30 days, free of charge, by courier or in
                    store.{" "}
                    <Link href="/returns" className="link">
                      Read the returns policy
                    </Link>
                  </p>
                </div>
              </Disclosure>
            </div>
          </div>
        </div>
      </section>

      <section className="section container-page stack rule-t" aria-labelledby="related">
        <h2 id="related" className="text-title">
          You may also like
        </h2>
        <ul className="grid-products">
          {/* Three fill the tablet row; four fill the desktop row. */}
          {related.map((p, i) => (
            <li key={p.slug} className={i >= 3 ? "md:max-xl:hidden" : undefined}>
              <ProductCard product={p} />
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}

function Disclosure({
  title,
  open,
  children,
}: {
  title: string;
  open?: boolean;
  children: React.ReactNode;
}) {
  return (
    <details open={open} className="group rule-t">
      <summary className="flex cursor-pointer list-none items-center justify-between py-4 text-ui [&::-webkit-details-marker]:hidden">
        {title}
        <span
          aria-hidden="true"
          className="text-xl leading-none transition-transform duration-(--duration-settle) ease-settle group-open:rotate-45"
        >
          +
        </span>
      </summary>
      <div className="pb-6">{children}</div>
    </details>
  );
}
