import type { Metadata } from "next";
import Link from "next/link";
import { BagLine } from "@/components/bag/bag-line";
import { CheckoutForm, CheckoutProgress } from "@/components/bag/checkout-form";
import { CheckoutStateProvider } from "@/components/bag/checkout-state";
import { getPendingOrderForUser } from "@/db/queries";
import { getSession } from "@/lib/auth/session";
import { getCart } from "@/lib/cart/server";
import { formatPrice } from "@/lib/format";
import { stripe } from "@/lib/stripe";

// Why the customer is back on the bag, from `?checkout=`. "Held" notices
// offer Resume payment when the earlier checkout can still be paid.
type Notice = { title: string; body: string; tone: "info" | "alert"; offersResume?: boolean };
const notices: Record<string, Notice> = {
  cancelled: {
    title: "Checkout cancelled",
    body: "Nothing was charged and your bag is unchanged.",
    tone: "info",
    offersResume: true,
  },
  pending: {
    title: "Your payment isn’t finished",
    body: "Nothing has been charged yet.",
    tone: "info",
    offersResume: true,
  },
  unavailable: {
    title: "Some pieces changed",
    body: "Availability changed since you added them. Check the items marked in red, then check out again.",
    tone: "alert",
  },
  stock: {
    title: "A piece was just reserved by someone else",
    body: "Nothing was charged. Check the items marked in red, then check out again.",
    tone: "alert",
  },
  failed: {
    title: "Your payment didn’t go through",
    body: "Your bank declined it, so nothing was charged and your pieces were released. You can check out again.",
    tone: "alert",
  },
  expired: {
    title: "Your checkout timed out",
    body: "Pieces are held for 30 minutes during payment. Nothing was charged; check out again to reserve them.",
    tone: "alert",
  },
  error: {
    title: "We couldn’t open checkout",
    body: "Nothing was charged and your bag is unchanged. Please try again in a moment.",
    tone: "alert",
  },
};

const timeFormat = new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit", timeZoneName: "short" });

/** The unfinished Stripe Checkout for this customer, if it can still be paid. */
async function resumableCheckout(userId: string) {
  const pending = await getPendingOrderForUser(userId);
  if (!pending?.stripeCheckoutSessionId || !pending.expiresAt) return undefined;
  if (pending.expiresAt.getTime() <= Date.now()) return undefined;
  try {
    const session = await stripe().checkout.sessions.retrieve(pending.stripeCheckoutSessionId);
    return session.status === "open" && session.url
      ? { url: session.url, until: pending.expiresAt }
      : undefined;
  } catch {
    return undefined;
  }
}

export const metadata: Metadata = {
  title: "Bag",
  robots: { index: false },
};

// Prices and stock are read fresh on every visit.
export const dynamic = "force-dynamic";

export default async function BagPage({ searchParams }: PageProps<"/bag">) {
  const [cart, current, { checkout }] = await Promise.all([getCart(), getSession(), searchParams]);
  const empty = cart.lines.length === 0;
  const notice = typeof checkout === "string" ? notices[checkout] : undefined;
  const resume = current && !empty ? await resumableCheckout(current.user.id) : undefined;
  // Sold-out lines stay visible but aren't in the subtotal, so don't count them.
  const billable = cart.lines
    .filter((l) => l.issue !== "sold-out")
    .reduce((sum, l) => sum + l.quantity, 0);
  const issueCount = cart.lines.filter((l) => l.issue).length;

  return (
    <div className="container-page flex flex-col gap-(--space-block) pt-8 pb-(--space-section) lg:pt-12">
      <nav aria-label="Breadcrumb">
        <ol className="flex flex-wrap gap-2 text-meta">
          <li>
            <Link href="/" className="link-quiet">
              Home
            </Link>
          </li>
          <li aria-hidden="true">/</li>
          <li aria-current="page">Bag</li>
        </ol>
      </nav>
      <div className="flex flex-wrap items-baseline justify-between gap-4">
        {/* Focus lands here when a line is removed. */}
        <h1 id="bag-heading" tabIndex={-1} className="text-headline outline-none">
          Your bag
        </h1>
        <p className="text-meta" aria-live="polite">
          {!empty && `${cart.itemCount} ${cart.itemCount === 1 ? "item" : "items"}`}
        </p>
      </div>

      {notice && (
        <div
          role={notice.tone === "alert" ? "alert" : "status"}
          className={`flex flex-col gap-1 border-l-2 pl-4 ${notice.tone === "alert" ? "border-alert" : "border-black"}`}
        >
          <p className={`text-ui font-medium ${notice.tone === "alert" ? "text-alert" : ""}`}>
            {notice.title}
          </p>
          <p className="text-sm text-graphite">
            {notice.body}
            {notice.offersResume && resume && (
              <> Your pieces are held until {timeFormat.format(resume.until)}.</>
            )}
          </p>
          {notice.offersResume && resume && (
            <div className="pt-2">
              <a href={resume.url} className="btn btn-secondary btn-sm">
                Resume payment
              </a>
            </div>
          )}
        </div>
      )}

      {empty ? (
        <section className="stack rule-t pt-(--space-block)" aria-label="Empty bag">
          <p className="text-subtitle">Your bag is empty.</p>
          <p className="text-body text-graphite max-w-(--container-copy)">
            Pieces you add will wait here. Prices and availability are checked
            again each time you come back.
          </p>
          <div className="flex flex-wrap gap-3">
            <Link href="/new" className="btn btn-primary">
              Shop new arrivals
            </Link>
            <Link href="/" className="btn btn-secondary">
              Go to the homepage
            </Link>
          </div>
        </section>
      ) : (
        <CheckoutStateProvider>
          <div className="grid gap-(--space-block) lg:grid-cols-[minmax(0,7fr)_minmax(0,4fr)] lg:gap-16">
            <section aria-label="Items in your bag">
              <ul className="divide-y divide-rule rule-y">
                {cart.lines.map((line) => (
                  <BagLine key={`${line.productId}:${line.size}`} line={line} />
                ))}
              </ul>

              {/* Phones: keep the total and the action in reach while scrolling a long
                  bag. Sticky within this section, so it settles above the summary. */}
              <div className="sticky bottom-0 z-10 -mx-(--gutter) flex items-center justify-between gap-4 border-t border-rule bg-white px-(--gutter) py-3 lg:hidden">
                <p className="flex flex-col">
                  <span className="text-meta">
                    Total · {billable} {billable === 1 ? "item" : "items"}
                  </span>
                  <span className="text-ui font-medium">{formatPrice(cart.subtotal)}</span>
                </p>
                {current ? (
                  <CheckoutForm disabled={cart.hasIssues} compact />
                ) : (
                  <Link href="/sign-in?next=%2Fbag" className="btn btn-primary shrink-0">
                    Sign in to check out
                  </Link>
                )}
              </div>
            </section>

            <aside
              aria-labelledby="summary-heading"
              className="flex flex-col gap-4 self-start bg-plaster p-6 lg:sticky lg:top-24"
            >
              <h2 id="summary-heading" className="text-subtitle">
                Summary
              </h2>
              <dl className="flex flex-col gap-2 rule-t pt-4 text-ui">
                <div className="flex items-baseline justify-between gap-4">
                  <dt>
                    Subtotal{" "}
                    <span className="text-meta">
                      ({billable} {billable === 1 ? "item" : "items"})
                    </span>
                  </dt>
                  <dd>{formatPrice(cart.subtotal)}</dd>
                </div>
                <div className="flex items-baseline justify-between gap-4">
                  <dt>Shipping</dt>
                  <dd>Free</dd>
                </div>
                <div className="flex items-baseline justify-between gap-4 rule-t pt-3 mt-1">
                  <dt className="font-medium">Total</dt>
                  <dd className="text-subtitle" aria-live="polite">
                    {formatPrice(cart.subtotal)}
                  </dd>
                </div>
              </dl>
              <p className="text-meta">
                US addresses only. Prices are confirmed when you check out, and you’ll pay on
                Stripe’s secure page.
              </p>
              {cart.hasIssues && (
                <p className="text-sm text-alert" role="status">
                  {issueCount === 1
                    ? "One piece in your bag has changed availability."
                    : `${issueCount} pieces in your bag have changed availability.`}{" "}
                  Fix the items marked in red to check out.
                </p>
              )}
              {current ? (
                <>
                  <CheckoutForm disabled={cart.hasIssues} />
                  <CheckoutProgress />
                </>
              ) : (
                <div className="flex flex-col gap-2">
                  <Link href="/sign-in?next=%2Fbag" className="btn btn-primary btn-lg btn-block">
                    Sign in to check out
                  </Link>
                  <p className="text-meta">
                    Your bag stays here while you sign in or{" "}
                    <Link href="/sign-up?next=%2Fbag" className="link">
                      create an account
                    </Link>
                    .
                  </p>
                </div>
              )}
              {resume && !(notice?.offersResume) && (
                <div className="flex flex-col gap-2 rule-t pt-4">
                  <p className="text-sm">
                    You have a checkout in progress. Your pieces are held until{" "}
                    {timeFormat.format(resume.until)}.
                  </p>
                  <a href={resume.url} className="btn btn-secondary btn-block">
                    Resume payment
                  </a>
                  <p className="text-meta">Checking out again replaces it with your current bag.</p>
                </div>
              )}
              <Link href="/new" className="link text-sm self-start">
                Continue shopping
              </Link>
            </aside>
          </div>
        </CheckoutStateProvider>
      )}
    </div>
  );
}
