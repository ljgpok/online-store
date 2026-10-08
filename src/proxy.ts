// Optimistic redirects only: this checks that a session cookie exists, not
// that it's valid, and never touches the database. The real checks are
// `requireUser` and `requireAdmin` in src/lib/auth/session.ts.
//
// It never redirects *away* from /sign-in or /sign-up: a cookie that exists
// but is no longer valid (revoked, expired, or signed with a rotated secret)
// would bounce between there and /account forever. Those pages check the
// session properly and send signed-in visitors on themselves.
import { getSessionCookie } from "better-auth/cookies";
import { NextResponse, type NextRequest } from "next/server";
import { RETURN_TO_HEADER } from "@/lib/auth/return-to";

export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  if (getSessionCookie(request)) {
    // Layouts can't see the URL, so pass it on for their sign-in redirect if
    // the cookie turns out to be stale. Always overwritten here, never trusted
    // beyond `safeNext`.
    const headers = new Headers(request.headers);
    headers.set(RETURN_TO_HEADER, pathname + search);
    return NextResponse.next({ request: { headers } });
  }

  const signIn = new URL("/sign-in", request.url);
  signIn.searchParams.set("next", pathname + search);
  return NextResponse.redirect(signIn);
}

export const config = {
  matcher: ["/account/:path*", "/admin/:path*"],
};
