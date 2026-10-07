This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app), wired up with [Drizzle ORM](https://orm.drizzle.team) + [Neon Postgres](https://neon.tech) and [Better Auth](https://www.better-auth.com).

## Setup

This project uses [pnpm](https://pnpm.io). Run `pnpm install` first.

1. Create `.env.local` with `DATABASE_URL` (Neon → Connect), `BETTER_AUTH_SECRET` (`openssl rand -base64 32`) and `BETTER_AUTH_URL` (`http://localhost:3000` in development). In production behind a proxy or CDN, also set `TRUSTED_IP_HEADER` to the client-IP header it overwrites (for example `cf-connecting-ip` on Cloudflare or `x-real-ip` on Vercel). Without it, sign-in rate limits are shared across all clients.
2. Create the tables (catalogue: `categories`, `products`, `product_images`; auth: `user`, `session`, `account`, `verification`) and load the starting products:
   ```bash
   pnpm db:migrate   # applies the SQL in drizzle/
   pnpm db:seed      # safe to re-run; upserts by slug
   ```
   The storefront reads products from the database, so pages return an error until this is done.

   After changing `src/db/schema.ts`, run `pnpm db:generate`, review the new SQL in `drizzle/`, then `pnpm db:migrate`. Use `db:push` only on a throwaway database.

   Auth uses self-hosted [Better Auth](https://www.better-auth.com) with email and password. Its tables are defined in `src/db/auth-schema.ts` and created by the same migrations.

## Getting Started

First, run the development server:

```bash
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
