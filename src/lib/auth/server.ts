// Self-hosted Better Auth. Users, sessions, accounts and verification tokens are
// tables in our Drizzle schema (src/db/auth-schema.ts), in the public schema.
// Relative imports and no `server-only`, so the Better Auth CLI can load this file.
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { db } from "../../db";

export const auth = betterAuth({
  database: drizzleAdapter(db, { provider: "pg" }),
  secret: process.env.BETTER_AUTH_SECRET,
  baseURL: process.env.BETTER_AUTH_URL,
  emailAndPassword: { enabled: true },
  // Lets server actions set the session cookie.
  plugins: [nextCookies()],
});
