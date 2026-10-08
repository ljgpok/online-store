// Optimistic redirects only: this checks that a session cookie exists, not
// that it's valid, and never touches the database. The real checks are
// `requireUser` and `requireAdmin` in src/lib/auth/session.ts.
import { getSessionCookie } from "better-auth/cookies";
import { NextResponse, type NextRequest } from "next/server";

const AUTH_PAGES = ["/sign-in", "/sign-up"];

export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const hasSession = Boolean(getSessionCookie(request));

  if (AUTH_PAGES.includes(pathname)) {
    return hasSession
      ? NextResponse.redirect(new URL("/account", request.url))
      : NextResponse.next();
  }

  if (!hasSession) {
    const signIn = new URL("/sign-in", request.url);
    signIn.searchParams.set("next", pathname + search);
    return NextResponse.redirect(signIn);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/account/:path*", "/admin/:path*", "/sign-in", "/sign-up"],
};
