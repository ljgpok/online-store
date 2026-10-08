import type { Metadata } from "next";
import { AdminHeader, AdminPending } from "@/components/admin/admin-header";
import { requireAdmin } from "@/lib/auth/session";

export const metadata: Metadata = { title: "New product · Admin", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function Page() {
  await requireAdmin("/admin/products/new");

  return (
    <>
      <AdminHeader title="New product" back={{ href: "/admin/products", label: "Products" }} />
      <AdminPending>The product form arrives in the next step.</AdminPending>
    </>
  );
}
