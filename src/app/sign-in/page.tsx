import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AuthForm } from "@/components/auth/auth-form";
import { getSession, safeNext } from "@/lib/auth/session";

export const metadata: Metadata = {
  title: "Sign in",
  description: "Sign in to your Claude Shop account.",
  robots: { index: false },
};

export const dynamic = "force-dynamic";

export default async function SignInPage({ searchParams }: PageProps<"/sign-in">) {
  const next = safeNext((await searchParams).next);
  // src/proxy.ts usually does this first; this covers a stale cookie check.
  if (await getSession()) redirect(next);

  const altHref = next === "/account" ? "/sign-up" : `/sign-up?next=${encodeURIComponent(next)}`;

  return (
    <section className="section container-copy stack">
      <h1 className="text-headline">Sign in</h1>
      <AuthForm mode="sign-in" next={next} />
      <p className="text-ui">
        New to Claude Shop?{" "}
        <Link href={altHref} className="link">
          Create an account
        </Link>
      </p>
    </section>
  );
}
