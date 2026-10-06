import Image from "next/image";
import Link from "next/link";
import { ProductCard } from "@/components/product-card";
import { getCategoriesWithCounts, getNewArrivals } from "@/db/queries";
import { campaign } from "@/lib/editorial";

const services = [
  {
    title: "Free delivery over $500",
    body: "Standard delivery in 3 to 5 business days, or express in 1 to 2 for $25.",
  },
  {
    title: "Returns within 30 days",
    body: "Send items back free of charge by courier, or return them in store.",
  },
  {
    title: "Store appointments",
    body: "Book time with a client advisor in store or on a video call.",
  },
  {
    title: "Gift wrapping",
    body: "Every order ships in our box, with a handwritten card if you ask.",
  },
];

// Rendered per request so stock badges reflect the database.
export const dynamic = "force-dynamic";

export default async function Home() {
  const [newArrivals, categories] = await Promise.all([
    getNewArrivals(),
    getCategoriesWithCounts(),
  ]);

  return (
    <>
      {/* Season campaign: the page's one lapis field. */}
      <section className="grid-split container-bleed">
        <div className="field-lapis section flex flex-col justify-end gap-8 px-(--gutter) lg:min-h-[calc(100svh-var(--header-height))]">
          <h1 className="text-display">Autumn–Winter 2026</h1>
          <p className="text-body text-lg">
            Long coats in double-faced wool, soft-structured bags and the
            season’s first knitwear.
          </p>
          <div className="flex flex-wrap gap-3">
            <Link href="/new" className="btn btn-inverse btn-lg">
              Shop the collection
            </Link>
          </div>
        </div>
        <div className="media-editorial md:aspect-[4/3] lg:aspect-auto">
          <Image
            src={campaign.hero.src}
            alt={campaign.hero.alt}
            fill
            preload
            sizes="(width >= 64rem) 42vw, 100vw"
            className="object-[50%_30%]"
          />
        </div>
      </section>

      <section
        className="section container-page stack"
        aria-labelledby="new-arrivals"
      >
        <div className="flex flex-wrap items-end justify-between gap-4">
          <h2 id="new-arrivals" className="text-title">
            New arrivals
          </h2>
          <Link href="/new" className="link text-ui">
            See all new arrivals
          </Link>
        </div>
        <ul className="grid-products">
          {/* Six fill two rows of three on tablets; eight fill two rows of four. */}
          {newArrivals.map((product, i) => (
            <li
              key={product.slug}
              className={i >= 6 ? "md:max-xl:hidden" : undefined}
            >
              <ProductCard product={product} />
            </li>
          ))}
        </ul>
      </section>

      {/* Full-bleed story, captioned below so the photograph stays clear. */}
      <section className="container-bleed" aria-labelledby="knitwear">
        <div className="media-hero">
          <Image
            src={campaign.knitwear.src}
            alt={campaign.knitwear.alt}
            fill
            sizes="100vw"
            className="object-[65%_50%]"
          />
        </div>
        <div className="container-page grid gap-6 pt-8 lg:grid-cols-[7fr_5fr] lg:pt-10">
          <h2 id="knitwear" className="text-headline">
            The knitwear edit
          </h2>
          <div className="flex flex-col items-start gap-6">
            <p className="text-body">
              Cable knits, ribbed cardigans and brushed alpaca in undyed wool
              tones, made to layer from October to March.
            </p>
            <Link href="/women/knitwear" className="btn btn-primary">
              Shop knitwear
            </Link>
          </div>
        </div>
      </section>

      <section className="section stack" aria-labelledby="categories">
        <div className="container-page">
          <h2 id="categories" className="text-title">
            Shop by category
          </h2>
        </div>
        <ul className="rail container-bleed">
          {categories.map((category) => (
            <li key={category.slug}>
              <Link href={category.href} className="flex flex-col gap-3">
                <div className="media-editorial">
                  {category.image && (
                    <Image
                      src={category.image.src}
                      alt=""
                      fill
                      sizes="(width >= 80rem) 25vw, (width >= 48rem) 33vw, 72vw"
                    />
                  )}
                </div>
                <span className="flex items-baseline justify-between gap-3">
                  <span className="text-subtitle">{category.name}</span>
                  <span className="text-meta">
                    {category.productCount}{" "}
                    {category.productCount === 1 ? "piece" : "pieces"}
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <section
        className="grid-split container-bleed"
        aria-labelledby="menswear"
      >
        <div className="media-editorial md:max-lg:aspect-[4/3]">
          <Image
            src={campaign.menswear.src}
            alt={campaign.menswear.alt}
            fill
            sizes="(width >= 64rem) 58vw, 100vw"
            className="object-top md:max-lg:object-[50%_42%]"
          />
        </div>
        <div className="section flex flex-col justify-center gap-6 px-(--gutter)">
          <h2 id="menswear" className="text-headline">
            Men’s outerwear
          </h2>
          <p className="text-body">
            Biker jackets in lambskin and calf leather, cut close through the
            shoulder and finished with heavy nickel zips.
          </p>
          <div className="flex flex-wrap gap-3">
            <Link href="/men/outerwear" className="btn btn-primary">
              Shop men’s outerwear
            </Link>
            <Link href="/men" className="btn btn-secondary">
              Shop all menswear
            </Link>
          </div>
        </div>
      </section>

      <section
        className="container-page rule-t py-12 lg:py-16"
        aria-labelledby="services"
      >
        <h2 id="services" className="visually-hidden">
          Our services
        </h2>
        <ul className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-4">
          {services.map((service) => (
            <li key={service.title} className="flex flex-col gap-1">
              <h3 className="text-ui">{service.title}</h3>
              <p className="text-meta">{service.body}</p>
            </li>
          ))}
        </ul>
      </section>

      <section className="section rule-t container-page">
        <form className="stack max-w-copy">
          <h2 className="text-title">New arrivals by email</h2>
          <p className="text-body text-graphite">
            We email when a collection arrives, and not in between.
          </p>
          <div>
            <label htmlFor="email" className="label">
              Email address
            </label>
            <div className="flex flex-col gap-2 sm:flex-row">
              <input
                id="email"
                name="email"
                type="email"
                required
                autoComplete="email"
                className="input"
              />
              <button type="submit" className="btn btn-primary">
                Subscribe
              </button>
            </div>
          </div>
          <Link href="/privacy" className="link text-meta self-start">
            How we use your email
          </Link>
        </form>
      </section>
    </>
  );
}
