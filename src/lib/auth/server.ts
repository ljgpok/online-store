// Self-hosted Better Auth. Users, sessions, accounts and verification tokens are
// tables in our Drizzle schema (src/db/auth-schema.ts), in the public schema.
// Relative imports and no `server-only`, so the Better Auth CLI can load this file.
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { db } from "../../db";

// The rate limiter buckets requests by client IP, read from a request header.
// Clients can set any header themselves, so only trust one that the proxy or
// CDN in front of the app overwrites on every request, such as
// `cf-connecting-ip` (Cloudflare) or `x-real-ip` (Vercel, most nginx setups).
// Unset, no header is trusted and every caller shares one bucket per endpoint,
// so one person could use up sign-in for everyone. A production server
// therefore refuses to start without it. (`next build` runs in production
// mode too, but serves no requests, so it's exempt.)
const trustedIpHeader = process.env.TRUSTED_IP_HEADER?.trim().toLowerCase();
if (
  process.env.NODE_ENV === "production" &&
  process.env.NEXT_PHASE !== "phase-production-build" &&
  !trustedIpHeader
) {
  throw new Error(
    "TRUSTED_IP_HEADER is not set. Set it to the client-IP header your proxy or CDN " +
      "overwrites (x-real-ip on Vercel, cf-connecting-ip on Cloudflare). Never x-forwarded-for.",
  );
}

export const auth = betterAuth({
  database: drizzleAdapter(db, { provider: "pg" }),
  secret: process.env.BETTER_AUTH_SECRET,
  baseURL: process.env.BETTER_AUTH_URL,
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 8,
    maxPasswordLength: 128,
    autoSignIn: true,
  },
  // Sessions are rows in `session` and last 30 days, extended at most once a
  // day while the customer keeps visiting. No cookie cache, so sign-out and
  // role changes apply on the next request.
  session: {
    expiresIn: 60 * 60 * 24 * 30,
    updateAge: 60 * 60 * 24,
  },
  user: {
    additionalFields: {
      // "customer" or "admin". `input: false` keeps sign-up and update-user
      // from accepting it, so only `pnpm auth:make-admin` can change it.
      role: {
        type: "string",
        required: true,
        defaultValue: "customer",
        input: false,
      },
    },
  },
  // Counts live in the `rateLimit` table, not in memory, so every serverless
  // instance shares them and they survive cold starts. On in production only.
  rateLimit: {
    storage: "database",
  },
  advanced: {
    ipAddress: {
      ipAddressHeaders: trustedIpHeader ? [trustedIpHeader] : [],
    },
  },
  // Lets server actions set the session cookie. Keep it last.
  plugins: [nextCookies()],
});

export type Session = typeof auth.$Infer.Session;
