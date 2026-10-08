import Link from "next/link";
import { AdminNav } from "@/components/admin/admin-nav";
import { requireAdmin } from "@/lib/auth/session";

// The admin shell. This check runs on first load, but layouts don't re-run on
// client navigation, so every admin page and server action checks the role
// itself too. `pnpm check:admin` enforces that.
export default async function AdminLayout({ children }: LayoutProps<"/admin">) {
  const { user } = await requireAdmin("/admin");

  return (
    <div className="container-page flex flex-col gap-(--space-block) pt-8 pb-(--space-section) lg:pt-12">
      <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2">
        <p className="text-subtitle font-semibold font-stretch-75% tracking-heading">Admin</p>
        <p className="text-meta">
          {user.email} ·{" "}
          <Link href="/" className="link-quiet underline underline-offset-4">
            Back to the shop
          </Link>
        </p>
      </div>
      <AdminNav />
      <div className="flex min-w-0 flex-col gap-(--space-block)">{children}</div>
    </div>
  );
}
