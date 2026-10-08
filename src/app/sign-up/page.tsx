import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AuthForm } from "@/components/auth/auth-form";
import { getSession, safeNext } from "@/lib/auth/session";

export const metadata: Metadata = {
  title: "Create an account",
  description: "Create a Claude Shop account.",
  robots: { index: false },
};

export const dynamic = "force-dynamic";

export default async function SignUpPage({ searchParams }: PageProps<"/sign-up">) {
  const next = safeNext((await searchParams).next);
  // src/proxy.ts usually does this first; this covers a stale cookie check.
  if (await getSession()) redirect(next);

  const altHref = next === "/account" ? "/sign-in" : `/sign-in?next=${encodeURIComponent(next)}`;

  return (
    <section className="section container-copy stack">
      <h1 className="text-headline">Create an account</h1>
      <AuthForm mode="sign-up" next={next} signInHref={altHref} />
      <p className="text-ui">
        Already have an account?{" "}
        <Link href={altHref} className="link">
          Sign in
        </Link>
      </p>
    </section>
  );
}
