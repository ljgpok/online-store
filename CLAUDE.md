@AGENTS.md

## Package manager

- Use **pnpm** (`pnpm install`, `pnpm dev`, `pnpm dlx`). There's no `package-lock.json`, so don't install with npm or yarn.

## Database

- **Scope:** Neon Postgres through Drizzle, everything in `public`:
  - the catalogue: `categories`, `products`, `product_images`;
  - Better Auth: `user`, `session`, `account`, `verification`, `rate_limit`;
  - checkout: `orders`, `order_items`, `stripe_events`.

  There's no stock table and no cart table. Reviews, wishlists and product variants are out of scope until asked for.
- **Status values:** order `status` and `stripe_payment_status` are enforced by CHECK constraints. `status` is our own state; `stripe_payment_status` is exactly what Stripe reports. Use the named groups in `schema.ts` (`OPEN_STATUSES`, `CONFIRMED_STATUSES`, `ORDER_ID_PATTERN`), not repeated literals.
- **Money:** stored as integer cents. The storefront types use whole dollars, and the conversion happens only in `src/db/queries.ts` (`mapProduct`, `mapCart`). Add totals up in cents first. Format with `formatPrice`.
- **Server/client boundary:** database reads go through `src/db/queries.ts` (`server-only`). Admin reads go through `src/db/admin-queries.ts`. Client components never import `@/db`. Never expose `DATABASE_URL` through a `NEXT_PUBLIC_` variable.
- **Freshness:** pages that show price, stock or orders use `dynamic = "force-dynamic"` and no `generateStaticParams`.
- **Atomic writes:** neon-http has no interactive transactions. Use `db.batch([...])` or a single statement (for example a CTE) for writes that must be all or nothing.
- **Schema changes:** edit `schema.ts`, run `pnpm db:generate`, review the SQL, run `pnpm db:migrate`, and commit `drizzle/`.
  - `db:migrate` runs `src/db/migrate.ts`, because `drizzle-kit migrate` exits with code 1 and no message against this database.
  - Never `db:push` a shared database: it would drop tables that aren't in the schema.
  - `db:generate` can't answer rename prompts without a terminal. If one table both drops and adds columns, split it into two migrations: add first, then drop.
  - For a new `NOT NULL` column, or when moving data, hand-edit the SQL (add as nullable, backfill, then set not null). Mark each edit with `-- Hand-edited:`.
- **Seed:** `pnpm db:seed` is for a fresh or development database only. It overwrites seeded products' stock, prices and images, and deletes unseeded categories that nothing uses. Never run it on a database admins manage, or one a deployment uses. Check every new sample photo by eye for visible brands.
- **Drizzle Studio is deliberately not a script.** It serves an unauthenticated SQL endpoint with wildcard CORS, so any open webpage could query the database. Use the Neon console. If Studio is truly needed, run `pnpm exec drizzle-kit studio --host 127.0.0.1` briefly, with no other sites open.

## Stock, bag and checkout

- **Stock is one number per product:** `products.stock_quantity` means "available to sell" and is shared by all sizes. `sizes` is only a list of labels. Made-to-order products stay orderable at 0 and take only what's on the shelf.
- **Stock states and wording live only in `src/lib/stock.ts`** (`stockState`, `stockCopy`, `stockTone`). Don't hard-code stock messages.
- **Never write `stock_quantity` with a read-then-write.** Every change is one conditional statement guarded by the `products_stock_non_negative` CHECK:
  - checkout reservation: `- n`;
  - release: `+ reserved_quantity`, at most once, guarded by `stock_released_at`;
  - admin "Adjust by": `+ n`, kept within 0 and `MAX_STOCK`;
  - admin "Set to": compare-and-set against the value the admin saw.
- **Made-to-order reservations** work out their shelf take in SQL inside the reservation batch, with the product rows locked, never from an earlier read.
- **The bag** is an httpOnly cookie holding only product ids, sizes and quantities. It's untrusted and re-priced and re-checked on every read. All changes go through `src/lib/cart/actions.ts`. It's tied to one browser, not to accounts: move it to a table if cross-device carts are needed.
- **A customer's own held stock is available to them.** Their unfinished checkout holds stock, but a new checkout releases it first. Pass the signed-in user's id (`forUserId`) whenever the bag, cart actions or checkout read stock. Otherwise cancelling on Stripe's page makes their own bag say "Sold out".
- **Checkout is Stripe-hosted, for signed-in customers only:**
  - The session is built only from the order rows (`price_data`), never from client values. Never pass `payment_method_types`.
  - A new checkout replaces the customer's unfinished one.
  - Attaching a session and cancelling an order are mutually exclusive claims:
    - attach only while the order is `pending_payment`;
    - cancel an order without a session only while it still has none;
    - whichever loses expires its Stripe session.

    Don't weaken either condition.
- **Order status changes only in `src/lib/checkout/orders.ts`,** through conditional updates. "Paid" comes only from a verified webhook or a server-side `sessions.retrieve`, never from the browser or the return URL.
  - A payment whose order reference, amount or currency doesn't match becomes `needs_review`.
  - So does one that arrives after the order closed, which is also logged.
- **Stripe:**
  - The API version is pinned in `src/lib/stripe.ts` (`2026-08-26.dahlia`). The production webhook endpoint must use the same version and subscribe to the four `checkout.session.*` events the code handles.
  - Use a restricted key (`rk_`) with only Checkout Sessions: Write and Payment Intents: Read. Never put it in a `NEXT_PUBLIC_` variable.
  - Return URLs come from `BETTER_AUTH_URL`, never from request headers.
  - Don't promise customers a receipt email: Stripe sends one only if that's enabled in the Dashboard.
- **Not built yet:** tax, paid shipping, refunds, deleting products, order actions, admin categories, and a scheduled job that settles missed webhooks. Today overdue orders are only settled when someone starts a checkout.

## Auth and admin

- **Better Auth, self-hosted,** with email and password only.
  - Regenerate `src/db/auth-schema.ts` with the Better Auth CLI (`--config src/lib/auth/server.ts`), then `db:generate` and `db:migrate`. Don't hand-edit it.
  - `server.ts` uses relative imports and no `server-only` so the CLI can load it.
  - We don't use Neon Auth, so ignore any leftover `neon_auth` schema.
- **Sign-in rate limit:**
  - Only the header named in `TRUSTED_IP_HEADER` is trusted for the client IP. It must be one the proxy or CDN *overwrites* (`x-real-ip` on Vercel, `cf-connecting-ip` on Cloudflare). Never `x-forwarded-for`: clients can forge it.
  - It's required on production servers, including Vercel Preview: without it auth endpoints return 500, by design.
  - Counts are kept in the `rate_limit` table. Don't switch back to memory storage, which doesn't work across serverless instances.
  - Sign-in and sign-up must go through `authClient` (`/api/auth`): `auth.api.*` calls skip the rate limiter.
- **Roles:** `user.role` is `"customer"` or `"admin"`, with `input: false`. Only `pnpm auth:make-admin <email>` changes it. Sessions are database rows with no cookie cache, so role changes and sign-out apply on the next request.
- **Reading the session:**
  - Server code reads it only through `src/lib/auth/session.ts`.
  - Pass any `?next=` value through `safeNext`.
  - `src/proxy.ts` only redirects signed-out visitors away from `/account` and `/admin`, and never authorizes anything. It must never redirect away from `/sign-in` or `/sign-up` based on the cookie: a stale cookie would loop forever.
- **Admin protection:** server actions are public endpoints, callable from any URL.
  - Every admin page, layout, `generateMetadata` and route handler awaits `requireAdmin` before any other await. Reading `params` and `searchParams` first is fine.
  - Every action in `src/lib/admin/actions/` calls it as its first statement.
  - Non-admins get a 404.
  - `pnpm lint` runs `scripts/check-admin-guards.mjs` to enforce this. Keep admin actions in that folder, so the check sees them.
- **Admin products:** product images must be on a host allowed in `next.config.ts` (`PRODUCT_IMAGE_HOSTS`). The product form never changes an existing product's stock: stock changes only on the Stock page.

## Environment and testing

- **Environment variables:**
  - Secrets live in `.env.local`, which git ignores: `DATABASE_URL`, `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, and in production `TRUSTED_IP_HEADER`.
  - Scripts outside Next load them through `src/db/load-env.ts`.
  - Claude's permission rules deny reading any `.env*` file, including `.env.example`. Don't read them another way; ask the user.
- **Shared database:** the development database is currently also used by the Vercel deployment, with real customer orders. Test against it only with temporary rows (slug, SKU or email starting `zz-repro-`), and delete them afterwards, checking that nothing is left behind.
- **No test suite or CI yet.** Verify with `pnpm exec tsc --noEmit`, `pnpm lint`, and real runs: curl, headless Chrome, and Stripe test mode.
  - Run `stripe listen --forward-to localhost:3000/api/stripe/webhook` while testing payments.
  - The Stripe CLI is installed in `~/.local/bin`, because Homebrew refuses to install on this Mac.
