import type { Metadata } from "next";
import { AdminHeader, AdminPending } from "@/components/admin/admin-header";
import { requireAdmin } from "@/lib/auth/session";

export const metadata: Metadata = { title: "New category · Admin", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function Page() {
  await requireAdmin("/admin/categories/new");

  return (
    <>
      <AdminHeader title="New category" back={{ href: "/admin/categories", label: "Categories" }} />
      <AdminPending>The category form arrives in the next step.</AdminPending>
    </>
  );
}
