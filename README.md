# Claude Shop

A luxury-fashion online store with a catalogue, accounts, a shopping bag, Stripe checkout and an admin area, **built entirely through agentic coding with [Claude Code](https://claude.com/claude-code)**.

## How it was built

I didn't write the code by hand. I built the shop by directing Claude Code, an AI coding agent, in plain language: describing what I wanted, approving or changing its plans, and checking the result in the browser. Claude Code wrote, ran and tested the code.

This is sometimes called *vibe coding*. Here it was closer to **agentic engineering**, because each step was planned, reviewed and verified rather than accepted blindly:

- **Plan first:** larger features (the database, checkout) started in Claude Code's plan mode. The agent inspected the project and proposed the tables, files and migration steps, and I approved them before any code was written.
- **Requests in my own words**, for example:
  - *"Build the first complete homepage… take inspiration from premium fashion websites… make it responsive and verify the result."*
  - *"Build the product detail page with large imagery, product information, price, category and stock state."*
  - *"Replace the product data with a real PostgreSQL database using Drizzle ORM."*
- **Checked by the agent:** type checks, lint, real database queries, headless-browser screenshots, test sign-ups and test payments.
- **Reviewed by a second AI:** [CodeRabbit](https://coderabbit.ai) reviewed the code. Claude Code fixed its two security findings:
  - IP spoofing that got around the sign-in rate limit (CWE-307);
  - an open CORS database tool (CWE-942).
- **Guardrails:**
  - Project rules live in [`CLAUDE.md`](CLAUDE.md), so every session follows the same database, security and design conventions.
  - Permission rules in `.claude/settings.json` stop the agent from reading `.env` secrets and make it ask before `git push`.
- **Skills:** reusable instructions for the agent, kept in `.claude/skills` and `.agents/skills`. There's one for building UI with this design system, plus the official Better Auth skills.

## Features

- **Storefront:** an editorial homepage, a new-arrivals page and product pages with large galleries, prices, sale prices and related products. Responsive from phone to desktop.
- **Live stock:** read from the database on every request. Each product shows one of four states: *In stock*, *Only 2 left*, *Sold out* or *Made to order* (still orderable, with a lead time).
- **Accounts:** sign up, sign in and sign out with email and password. Signed-in customers get an account page and their order history.
- **Shopping bag:** kept in a cookie. It's checked against current prices and stock before checkout.
- **Stripe checkout:**
  - stock is reserved when checkout starts;
  - payment happens on Stripe's hosted page;
  - the order is confirmed by a signature-checked webhook, and repeated events are handled only once;
  - stock goes back when a checkout is cancelled, expires or fails.
- **Admin area:** manage products, categories, stock and orders. Only users with the admin role can open it, and a lint check makes sure every admin page has that guard.

## Tech stack

| | |
|---|---|
| Framework | [Next.js 16](https://nextjs.org) (App Router), React 19, TypeScript |
| Styling | [Tailwind CSS v4](https://tailwindcss.com) with a custom design system (lapis blue, Instrument Sans) |
| Database | [Neon](https://neon.tech) serverless Postgres |
| ORM | [Drizzle ORM](https://orm.drizzle.team) and drizzle-kit migrations |
| Auth | [Better Auth](https://www.better-auth.com) (self-hosted, email and password, roles) |
| Payments | [Stripe](https://stripe.com) Checkout and webhooks |
| Images | [Unsplash](https://unsplash.com) photography, shown with `next/image` |
| Package manager | [pnpm](https://pnpm.io) |
| AI tooling | [Claude Code](https://claude.com/claude-code) (built it), [CodeRabbit](https://coderabbit.ai) (reviewed it) |

## Run it locally

You need Node 20 or later, pnpm, a Neon database and a Stripe account in test mode.

1. **Install:** run `pnpm install`.
2. **Environment:** copy `.env.example` to `.env.local` and fill it in.
   - `DATABASE_URL`: from Neon → Connect.
   - `BETTER_AUTH_SECRET`: generate with `openssl rand -base64 32`.
   - `BETTER_AUTH_URL`: `http://localhost:3000`.
   - `STRIPE_SECRET_KEY`: a restricted test key (`rk_test_…`) with **Checkout Sessions: Write** and **Payment Intents: Read**.
   - `STRIPE_WEBHOOK_SECRET`: printed by `stripe listen` (see step 5).
   - `TRUSTED_IP_HEADER`: leave empty locally. In production behind a proxy or CDN, set it to the client-IP header that the proxy *overwrites* (`cf-connecting-ip` on Cloudflare, `x-real-ip` on Vercel). Never use `x-forwarded-for`, because clients can fake it.
3. **Database:** create the tables and load the sample catalogue (13 products):
   ```bash
   pnpm db:migrate   # applies the SQL in drizzle/
   pnpm db:seed      # safe to re-run
   ```
4. **Run** `pnpm dev`, then open [http://localhost:3000](http://localhost:3000).
5. **Stripe webhooks** (only while testing payments): install the [Stripe CLI](https://docs.stripe.com/stripe-cli), run `stripe login`, then keep this running:
   ```bash
   stripe listen --latest --forward-to localhost:3000/api/stripe/webhook \
     --events checkout.session.completed,checkout.session.async_payment_succeeded,checkout.session.async_payment_failed,checkout.session.expired
   ```
   Pay with the test card `4242 4242 4242 4242`, any future date and any CVC.
6. **Admin:** sign up, then make your account an admin with `pnpm auth:make-admin you@example.com`.

After changing `src/db/schema.ts`, run `pnpm db:generate`, review the new SQL in `drizzle/`, then run `pnpm db:migrate`. Don't use `db:push` on a shared database.

## Deploying

1. **Set the environment variables** above in your host, with:
   - a **live** restricted Stripe key;
   - your real `BETTER_AUTH_URL`;
   - `TRUSTED_IP_HEADER`.
2. **Add the webhook endpoint** in the Stripe Dashboard (Developers → Webhooks):
   - URL: `https://your-domain/api/stripe/webhook`
   - API version: `2026-08-26.dahlia`
   - events: the same four as above.

   Then use that endpoint's signing secret as `STRIPE_WEBHOOK_SECRET`.

## Not built yet

Tax, paid shipping, refunds, reviews, wishlists and product variants.
