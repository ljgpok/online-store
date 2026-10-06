import Link from "next/link";

export default function NotFound() {
  return (
    <section className="section container-page stack min-h-[50svh] justify-center">
      <h1 className="text-headline">We can’t find that page</h1>
      <p className="text-body">
        The link may be out of date, or the page hasn’t been built yet.
      </p>
      <div className="flex flex-wrap gap-3">
        <Link href="/" className="btn btn-primary">
          Go to the homepage
        </Link>
        <Link href="/new" className="btn btn-secondary">
          Shop new arrivals
        </Link>
      </div>
    </section>
  );
}
