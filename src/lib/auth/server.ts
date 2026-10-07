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
// Unset, no header is trusted: sign-in attempts share one bucket per endpoint,
// which keeps the limit in force even if someone forges a forwarded IP.
const trustedIpHeader = process.env.TRUSTED_IP_HEADER?.trim().toLowerCase();

export const auth = betterAuth({
  database: drizzleAdapter(db, { provider: "pg" }),
  secret: process.env.BETTER_AUTH_SECRET,
  baseURL: process.env.BETTER_AUTH_URL,
  emailAndPassword: { enabled: true },
  advanced: {
    ipAddress: {
      ipAddressHeaders: trustedIpHeader ? [trustedIpHeader] : [],
    },
  },
  // Lets server actions set the session cookie.
  plugins: [nextCookies()],
});
