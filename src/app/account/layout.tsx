import Link from "next/link";
import { AccountNav } from "@/components/account/account-nav";
import { requestedPath, requireUser } from "@/lib/auth/session";

// Layouts don't re-run on client navigation, so each account page calls
// `requireUser` as well. `getSession` is cached, so the repeat is free.
export default async function AccountLayout({ children }: LayoutProps<"/account">) {
  const { user } = await requireUser(await requestedPath("/account"));
  const firstName = user.name.trim().split(/\s+/)[0] || user.name;

  return (
    <div className="container-page flex flex-col gap-(--space-block) pt-8 pb-(--space-section) lg:pt-12">
      <nav aria-label="Breadcrumb">
        <ol className="flex flex-wrap gap-2 text-meta">
          <li>
            <Link href="/" className="link-quiet">
              Home
            </Link>
          </li>
          <li aria-hidden="true">/</li>
          <li aria-current="page">Account</li>
        </ol>
      </nav>
      <p className="text-headline">Hello, {firstName}</p>

      <div className="grid gap-(--space-block) lg:grid-cols-[14rem_minmax(0,1fr)] lg:gap-16">
        <AccountNav isAdmin={user.role === "admin"} />
        <div className="min-w-0">{children}</div>
      </div>
    </div>
  );
}
