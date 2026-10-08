import type { Metadata } from "next";
import { AdminHeader, AdminPending } from "@/components/admin/admin-header";
import { requireAdmin } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Categories · Admin", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function Page() {
  await requireAdmin("/admin/categories");

  return (
    <>
      <AdminHeader title="Categories" />
      <AdminPending>Category management arrives in the next step.</AdminPending>
    </>
  );
}
