// The only way server code reads the session. Pages, layouts, server actions
// and route handlers call these; `src/proxy.ts` only checks that a cookie
// exists, so it never decides who may see or change anything.
import "server-only";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { cache } from "react";
import { auth } from "./server";

export type Role = "customer" | "admin";

export type SessionUser = {
  id: string;
  name: string;
  email: string;
  role: Role;
  /** When the account was created. */
  memberSince: Date;
};

export type CurrentSession = {
  user: SessionUser;
  /** When this sign-in started. */
  signedInAt: Date;
};

const DEFAULT_RETURN = "/account";

// One database lookup per request, however many components ask.
export const getSession = cache(async (): Promise<CurrentSession | null> => {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return null;
  const { user } = session;
  return {
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      // Anything other than "admin" is treated as a customer.
      role: user.role === "admin" ? "admin" : "customer",
      memberSince: user.createdAt,
    },
    signedInAt: session.session.createdAt,
  };
});

/** The signed-in session, or a redirect to sign-in that comes back to `returnTo`. */
export async function requireUser(returnTo: string): Promise<CurrentSession> {
  const session = await getSession();
  if (!session) {
    redirect(`/sign-in?next=${encodeURIComponent(safeNext(returnTo))}`);
  }
  return session;
}

/**
 * An admin's session. Signed-out visitors go to sign-in; signed-in customers
 * get a 404 so the admin area isn't advertised. Call it first in every admin
 * page, server action and route handler, since actions are public endpoints.
 */
export async function requireAdmin(returnTo: string): Promise<CurrentSession> {
  const session = await requireUser(returnTo);
  if (session.user.role !== "admin") notFound();
  return session;
}

/**
 * A same-site path to send someone to after signing in. Rejects absolute
 * URLs and protocol-relative ones (`//host`, `/\host`) so `?next=` can't be
 * used as an open redirect.
 */
export function safeNext(next: unknown): string {
  if (typeof next !== "string" || !next.startsWith("/")) return DEFAULT_RETURN;
  if (next.startsWith("//") || next.startsWith("/\\")) return DEFAULT_RETURN;
  if (/[\u0000-\u001f]/.test(next)) return DEFAULT_RETURN;
  return next;
}
